import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { CredentialsService } from './credentials.service';
import { Credentials } from './entities/credentials.entity';
import { SharedModule } from '@shared/shared.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Credentials]),
    forwardRef(() => SharedModule) // Use forwardRef to avoid circular dependency
  ],
  controllers: [SettingsController],
  providers: [SettingsService, CredentialsService],
  exports: [CredentialsService] // Export for use in S3Service
})
export class SettingsModule {}
