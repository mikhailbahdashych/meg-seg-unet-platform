import { Controller, Get, Put, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateAwsCredentialsDto } from './dto/update-aws-credentials.dto';
import { UpdateRunpodCredentialsDto } from './dto/update-runpod-credentials.dto';
import { CredentialsStatusDto } from './dto/credentials-status.dto';

@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get('credentials/status')
  async getStatus(): Promise<CredentialsStatusDto> {
    return this.settingsService.getCredentialsStatus();
  }

  @Put('credentials/aws')
  async updateAwsCredentials(
    @Body() dto: UpdateAwsCredentialsDto
  ): Promise<{ success: boolean; error?: string }> {
    return this.settingsService.updateAwsCredentials(dto);
  }

  @Put('credentials/runpod')
  async updateRunpodCredentials(
    @Body() dto: UpdateRunpodCredentialsDto
  ): Promise<{ success: boolean; error?: string }> {
    return this.settingsService.updateRunpodCredentials(dto);
  }

  @Post('credentials/aws/validate')
  async validateAws(): Promise<{ valid: boolean; error?: string }> {
    return this.settingsService.validateAwsCredentials();
  }

  @Post('credentials/runpod/validate')
  async validateRunpod(): Promise<{ valid: boolean; error?: string }> {
    return this.settingsService.validateRunpodCredentials();
  }
}
