import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Credentials } from './entities/credentials.entity';

@Injectable()
export class CredentialsService implements OnModuleInit {
  private encryptionKey: Buffer;
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_PATH = path.join(process.cwd(), 'medseg-encryption.key');
  private credentialsCache: Credentials | null = null;

  constructor(
    @InjectRepository(Credentials)
    private credentialsRepository: Repository<Credentials>
  ) {}

  async onModuleInit() {
    // Load or generate encryption key on module initialization
    this.encryptionKey = this.loadOrGenerateEncryptionKey();
  }

  private loadOrGenerateEncryptionKey(): Buffer {
    try {
      if (fs.existsSync(this.KEY_PATH)) {
        return fs.readFileSync(this.KEY_PATH);
      } else {
        console.log('Generating new encryption key at', this.KEY_PATH);
        const key = crypto.randomBytes(32);
        fs.writeFileSync(this.KEY_PATH, key, { mode: 0o600 });
        return key;
      }
    } catch (error) {
      throw new Error(`Failed to load/generate encryption key: ${error.message}`);
    }
  }

  encrypt(plaintext: string): string {
    if (!plaintext) return '';

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) return '';

    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  async getAwsCredentials(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
  } | null> {
    const creds = await this.getCachedCredentials();

    if (!creds || !creds.awsAccessKeyId) {
      return null;
    }

    try {
      return {
        accessKeyId: this.decrypt(creds.awsAccessKeyId),
        secretAccessKey: this.decrypt(creds.awsSecretAccessKey),
        region: creds.awsRegion,
        bucketName: creds.awsS3BucketName
      };
    } catch (error) {
      console.error('Error decrypting AWS credentials:', error);
      return null;
    }
  }

  async getRunpodApiKey(): Promise<string | null> {
    const creds = await this.getCachedCredentials();

    if (!creds || !creds.runpodApiKey) {
      return null;
    }

    try {
      return this.decrypt(creds.runpodApiKey);
    } catch (error) {
      console.error('Error decrypting RunPod API key:', error);
      return null;
    }
  }

  async hasValidAwsCredentials(): Promise<boolean> {
    const creds = await this.getCachedCredentials();
    return !!(creds && creds.awsAccessKeyId && creds.awsValidated);
  }

  async hasValidRunpodCredentials(): Promise<boolean> {
    const creds = await this.getCachedCredentials();
    return !!(creds && creds.runpodApiKey && creds.runpodValidated);
  }

  private async getCachedCredentials(): Promise<Credentials | null> {
    if (this.credentialsCache) {
      return this.credentialsCache;
    }

    const creds = await this.credentialsRepository.find();
    if (creds.length > 0) {
      this.credentialsCache = creds[0];
      return this.credentialsCache;
    }

    return null;
  }

  invalidateCache(): void {
    this.credentialsCache = null;
  }

  maskSecret(
    secret: string | null,
    prefixLen = 4,
    suffixLen = 4
  ): string | undefined {
    if (!secret) return undefined;

    try {
      const decrypted = this.decrypt(secret);
      if (decrypted.length <= prefixLen + suffixLen) return '***';

      const prefix = decrypted.substring(0, prefixLen);
      const suffix = decrypted.substring(decrypted.length - suffixLen);
      return `${prefix}***${suffix}`;
    } catch (error) {
      return '***';
    }
  }
}
