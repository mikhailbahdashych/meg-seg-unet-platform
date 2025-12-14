import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Credentials } from './entities/credentials.entity';
import { CredentialsService } from './credentials.service';
import { UpdateAwsCredentialsDto } from './dto/update-aws-credentials.dto';
import { UpdateRunpodCredentialsDto } from './dto/update-runpod-credentials.dto';
import { CredentialsStatusDto } from './dto/credentials-status.dto';
import { S3Service } from '@shared/services/s3.service';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Credentials)
    private credentialsRepository: Repository<Credentials>,
    private credentialsService: CredentialsService,
    @Inject(forwardRef(() => S3Service))
    private s3Service: S3Service
  ) {}

  async getCredentials(): Promise<Credentials> {
    const creds = await this.credentialsRepository.find();

    if (creds.length === 0) {
      // Create initial empty credentials record
      const newCreds = this.credentialsRepository.create({
        awsValidated: false,
        runpodValidated: false
      });
      return this.credentialsRepository.save(newCreds);
    }

    // Enforce single-row constraint
    return creds[0];
  }

  async updateAwsCredentials(dto: UpdateAwsCredentialsDto): Promise<{
    success: boolean;
    bucketCreated?: boolean;
    error?: string;
  }> {
    const creds = await this.getCredentials();

    // Encrypt and save credentials
    creds.awsAccessKeyId = this.credentialsService.encrypt(dto.awsAccessKeyId);
    creds.awsSecretAccessKey = this.credentialsService.encrypt(
      dto.awsSecretAccessKey
    );
    creds.awsRegion = dto.awsRegion;
    creds.awsS3BucketName = dto.awsS3BucketName;
    creds.awsValidated = false; // Reset validation status

    await this.credentialsRepository.save(creds);
    this.credentialsService.invalidateCache();

    // Initialize S3Service with new credentials
    await this.s3Service.initializeWithCredentials({
      accessKeyId: dto.awsAccessKeyId,
      secretAccessKey: dto.awsSecretAccessKey,
      region: dto.awsRegion,
      bucketName: dto.awsS3BucketName
    });

    // Ensure bucket exists (create if needed)
    const bucketResult = await this.s3Service.ensureBucketExists(
      dto.awsS3BucketName,
      dto.awsRegion
    );

    if (!bucketResult.exists) {
      return {
        success: false,
        error: bucketResult.error || 'Failed to access or create S3 bucket'
      };
    }

    // Auto-validate credentials
    const validationResult = await this.validateAwsCredentials();

    return {
      success: validationResult.valid,
      bucketCreated: bucketResult.created,
      error: validationResult.error
    };
  }

  async updateRunpodCredentials(
    dto: UpdateRunpodCredentialsDto
  ): Promise<{ success: boolean; error?: string }> {
    const creds = await this.getCredentials();

    // Encrypt and save credentials
    creds.runpodApiKey = this.credentialsService.encrypt(dto.runpodApiKey);
    creds.runpodValidated = false; // Reset validation status

    await this.credentialsRepository.save(creds);
    this.credentialsService.invalidateCache();

    // Auto-validate credentials
    const validationResult = await this.validateRunpodCredentials();

    return {
      success: validationResult.valid,
      error: validationResult.error
    };
  }

  async validateAwsCredentials(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Get credentials from database
      const awsCreds = await this.credentialsService.getAwsCredentials();

      if (!awsCreds) {
        return { valid: false, error: 'AWS credentials not configured' };
      }

      // Initialize S3Service with new credentials
      await this.s3Service.initializeWithCredentials(awsCreds);

      // Test S3 connection
      const testResult = await this.s3Service.testConnection();

      const creds = await this.getCredentials();
      creds.awsValidated = testResult.success;
      creds.awsLastValidatedAt = new Date();

      await this.credentialsRepository.save(creds);
      this.credentialsService.invalidateCache();

      return {
        valid: testResult.success,
        error: testResult.success ? undefined : testResult.error
      };
    } catch (error) {
      console.error('Error validating AWS credentials:', error);

      const creds = await this.getCredentials();
      creds.awsValidated = false;
      creds.awsLastValidatedAt = new Date();
      await this.credentialsRepository.save(creds);
      this.credentialsService.invalidateCache();

      return {
        valid: false,
        error: error.message || 'Failed to validate AWS credentials'
      };
    }
  }

  async validateRunpodCredentials(): Promise<{
    valid: boolean;
    error?: string;
  }> {
    // Stub implementation for now - will be implemented with RunPod integration
    const creds = await this.getCredentials();

    if (!creds.runpodApiKey) {
      return { valid: false, error: 'RunPod API key not configured' };
    }

    // For now, just mark as validated if key is provided
    creds.runpodValidated = true;
    creds.runpodLastValidatedAt = new Date();
    await this.credentialsRepository.save(creds);
    this.credentialsService.invalidateCache();

    return { valid: true };
  }

  async getCredentialsStatus(): Promise<CredentialsStatusDto> {
    const creds = await this.getCredentials();

    return {
      awsConfigured: !!creds.awsAccessKeyId,
      awsValidated: creds.awsValidated,
      awsLastValidatedAt: creds.awsLastValidatedAt,
      awsAccessKeyIdMasked: this.credentialsService.maskSecret(
        creds.awsAccessKeyId,
        4,
        4
      ),
      awsRegion: creds.awsRegion,
      awsS3BucketName: creds.awsS3BucketName,

      runpodConfigured: !!creds.runpodApiKey,
      runpodValidated: creds.runpodValidated,
      runpodLastValidatedAt: creds.runpodLastValidatedAt,
      runpodApiKeyMasked: this.credentialsService.maskSecret(
        creds.runpodApiKey,
        4,
        6
      )
    };
  }

  async deleteAwsCredentials(): Promise<{ success: boolean }> {
    const creds = await this.getCredentials();

    // Clear AWS credentials
    creds.awsAccessKeyId = null;
    creds.awsSecretAccessKey = null;
    creds.awsRegion = null;
    creds.awsS3BucketName = null;
    creds.awsValidated = false;
    creds.awsLastValidatedAt = null;

    await this.credentialsRepository.save(creds);
    this.credentialsService.invalidateCache();

    return { success: true };
  }

  async deleteRunpodCredentials(): Promise<{ success: boolean }> {
    const creds = await this.getCredentials();

    // Clear RunPod credentials
    creds.runpodApiKey = null;
    creds.runpodValidated = false;
    creds.runpodLastValidatedAt = null;

    await this.credentialsRepository.save(creds);
    this.credentialsService.invalidateCache();

    return { success: true };
  }
}
