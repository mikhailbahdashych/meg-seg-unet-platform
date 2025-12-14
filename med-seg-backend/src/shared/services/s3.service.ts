import { Injectable } from '@nestjs/common';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  CreateBucketCommandInput,
  BucketLocationConstraint
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import * as fs from 'fs';
import * as path from 'path';
import { UploadException } from '@common/exceptions/upload.exception';
import { ApiConfigService } from '@shared/services/api-config.service';

@Injectable()
export class S3Service {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;

  constructor(private apiConfigService: ApiConfigService) {}

  private async initializeClient(): Promise<void> {
    try {
      // Use environment variables (backward compatibility)
      // When user configures credentials via Settings, SettingsService will call
      // initializeWithCredentials() directly to override these
      this.s3Client = new S3Client({
        region: this.apiConfigService.awsRegion,
        credentials: {
          accessKeyId: this.apiConfigService.awsAccessKeyId,
          secretAccessKey: this.apiConfigService.awsSecretAccessKey
        }
      });
      this.bucketName = this.apiConfigService.awsS3BucketName;
    } catch (error) {
      throw new Error(`Failed to initialize S3 client: ${error.message}`);
    }
  }

  async initializeWithCredentials(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
  }): Promise<void> {
    this.s3Client = new S3Client({
      region: credentials.region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      }
    });
    this.bucketName = credentials.bucketName;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.s3Client) {
      await this.initializeClient();
    }
  }

  async refreshCredentials(): Promise<void> {
    this.s3Client = null;
    this.bucketName = null;
    await this.initializeClient();
  }

  async uploadFile(filePath: string, s3Key: string): Promise<void> {
    await this.ensureInitialized();

    try {
      const fileStream = fs.createReadStream(filePath);
      const upload = new Upload({
        client: this.s3Client!,
        params: {
          Bucket: this.bucketName!,
          Key: s3Key,
          Body: fileStream
        }
      });

      await upload.done();
    } catch (error) {
      throw new UploadException(`Failed to upload file to S3: ${error.message}`);
    }
  }

  async uploadDirectory(localDir: string, s3Prefix: string): Promise<number> {
    await this.ensureInitialized();

    const files = fs.readdirSync(localDir);
    let uploadedCount = 0;

    for (const file of files) {
      const filePath = path.join(localDir, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        const s3Key = `${s3Prefix}/${file}`;
        await this.uploadFile(filePath, s3Key);
        uploadedCount++;
      }
    }

    return uploadedCount;
  }

  async deleteDirectory(s3Prefix: string): Promise<void> {
    await this.ensureInitialized();

    try {
      // List all objects with the given prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName!,
        Prefix: s3Prefix
      });

      const listedObjects = await this.s3Client!.send(listCommand);

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        return;
      }

      // Delete all objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucketName!,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key }))
        }
      });

      await this.s3Client!.send(deleteCommand);

      // If there are more objects, recursively delete
      if (listedObjects.IsTruncated) {
        await this.deleteDirectory(s3Prefix);
      }
    } catch (error) {
      console.error(`Failed to delete from S3: ${error.message}`);
      throw new UploadException(
        `Failed to delete directory from S3: ${error.message}`
      );
    }
  }

  calculateDirectorySize(dirPath: string): number {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isFile()) {
        totalSize += stat.size;
      } else if (stat.isDirectory()) {
        totalSize += this.calculateDirectorySize(filePath);
      }
    }

    return totalSize;
  }

  async getPresignedDownloadUrl(
    s3Key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    await this.ensureInitialized();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName!,
        Key: s3Key
      });

      const url = await getSignedUrl(this.s3Client!, command, { expiresIn });
      return url;
    } catch (error) {
      throw new UploadException(
        `Failed to generate presigned URL: ${error.message}`
      );
    }
  }

  async downloadFileAsString(s3Key: string): Promise<string> {
    await this.ensureInitialized();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName!,
        Key: s3Key
      });

      const response = await this.s3Client!.send(command);
      const stream = response.Body;

      // Convert stream to string
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf-8');
    } catch (error) {
      throw new UploadException(`Failed to download file from S3: ${error.message}`);
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureInitialized();

      const command = new ListObjectsV2Command({
        Bucket: this.bucketName!,
        MaxKeys: 1
      });

      await this.s3Client!.send(command);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to connect to S3'
      };
    }
  }

  async ensureBucketExists(
    bucketName: string,
    region: string
  ): Promise<{ exists: boolean; created: boolean; error?: string }> {
    try {
      await this.ensureInitialized();

      // Check if bucket exists
      try {
        const headCommand = new HeadBucketCommand({
          Bucket: bucketName
        });
        await this.s3Client!.send(headCommand);
        return { exists: true, created: false };
      } catch (error) {
        // Bucket doesn't exist or access denied
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          // Try to create the bucket
          try {
            const createParams: CreateBucketCommandInput = {
              Bucket: bucketName
            };

            // For regions other than us-east-1, specify LocationConstraint
            if (region && region !== 'us-east-1') {
              createParams.CreateBucketConfiguration = {
                LocationConstraint: region as BucketLocationConstraint
              };
            }

            const createCommand = new CreateBucketCommand(createParams);
            await this.s3Client!.send(createCommand);

            return { exists: true, created: true };
          } catch (createError) {
            return {
              exists: false,
              created: false,
              error: `Failed to create bucket: ${createError.message}`
            };
          }
        } else {
          // Access denied or other error
          return {
            exists: false,
            created: false,
            error: `Cannot access bucket: ${error.message}`
          };
        }
      }
    } catch (error) {
      return {
        exists: false,
        created: false,
        error: error.message || 'Failed to check/create bucket'
      };
    }
  }
}
