import { Injectable } from '@nestjs/common';
import {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import * as fs from 'fs';
import * as path from 'path';
import { UploadException } from '@common/exceptions/upload.exception';
import { ApiConfigService } from '@shared/services/api-config.service';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private apiConfigService: ApiConfigService) {
    this.s3Client = new S3Client({
      region: this.apiConfigService.awsRegion,
      credentials: {
        accessKeyId: this.apiConfigService.awsAccessKeyId,
        secretAccessKey: this.apiConfigService.awsSecretAccessKey
      }
    });
    this.bucketName = this.apiConfigService.awsS3BucketName;
  }

  async uploadFile(filePath: string, s3Key: string): Promise<void> {
    try {
      const fileStream = fs.createReadStream(filePath);
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucketName,
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
    try {
      // List all objects with the given prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: s3Prefix
      });

      const listedObjects = await this.s3Client.send(listCommand);

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        return;
      }

      // Delete all objects
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key }))
        }
      });

      await this.s3Client.send(deleteCommand);

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
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      throw new UploadException(
        `Failed to generate presigned URL: ${error.message}`
      );
    }
  }
}
