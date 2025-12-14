import { Controller, Get, Query } from '@nestjs/common';
import { RunPodGraphQLService } from './services/runpod-graphql.service';
import { RunPodTemplatesService } from './services/runpod-templates.service';
import { GpuTypeDto } from './dto/gpu-type.dto';

@Controller('training')
export class TrainingController {
  constructor(
    private runpodGraphQLService: RunPodGraphQLService,
    private runpodTemplatesService: RunPodTemplatesService
  ) {}

  @Get('gpu-types')
  async getAvailableGpuTypes(): Promise<GpuTypeDto[]> {
    const types = await this.runpodGraphQLService.queryGpuTypes();

    // Mark recommended GPUs (16GB+ VRAM, <$0.50/hr)
    return types.map((gpu) => ({
      ...gpu,
      recommended: gpu.memoryInGb >= 16 && gpu.uninterruptablePrice < 0.5
    }));
  }

  @Get('templates')
  async getTemplates(
    @Query('includeRunpodTemplates') includeRunpodTemplates?: string,
    @Query('includePublicTemplates') includePublicTemplates?: string,
    @Query('includeEndpointBoundTemplates') includeEndpointBoundTemplates?: string
  ): Promise<any[]> {
    return this.runpodTemplatesService.getTemplates(
      includeRunpodTemplates === 'true',
      includePublicTemplates === 'true',
      includeEndpointBoundTemplates === 'true'
    );
  }
}
