import { Controller, Get } from '@nestjs/common';
import { RunPodGraphQLService } from './services/runpod-graphql.service';
import { GpuTypeDto } from './dto/gpu-type.dto';

@Controller('training')
export class TrainingController {
  constructor(private runpodGraphQLService: RunPodGraphQLService) {}

  @Get('gpu-types')
  async getAvailableGpuTypes(): Promise<GpuTypeDto[]> {
    const types = await this.runpodGraphQLService.queryGpuTypes();

    // Mark recommended GPUs (16GB+ VRAM, <$0.50/hr)
    return types.map((gpu) => ({
      ...gpu,
      recommended: gpu.memoryInGb >= 16 && gpu.uninterruptablePrice < 0.5
    }));
  }
}
