import { Module } from '@nestjs/common';
import { S3Service } from '@shared/services/s3.service';
import { FileValidationService } from '@shared/services/file-validation.service';
import { ApiConfigService } from '@shared/services/api-config.service';

@Module({
  imports: [],
  providers: [S3Service, FileValidationService, ApiConfigService],
  exports: [S3Service, FileValidationService, ApiConfigService]
})
export class SharedModule {}
