import { Module, forwardRef, OnModuleDestroy } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Model } from '@models/entities/model.entity';
import { Dataset } from '@datasets/entities/dataset.entity';
import { SettingsModule } from '@settings/settings.module';
import { SharedModule } from '@shared/shared.module';
import { ModelsModule } from '@models/models.module';
import { TrainingController } from './training.controller';
import { RunPodGraphQLService } from './services/runpod-graphql.service';
import { PodSshService } from './services/pod-ssh.service';
import { TrainingBundleService } from './services/training-bundle.service';
import { RunPodOrchestratorService } from './services/runpod-orchestrator.service';
import { TrainingMonitorService } from './services/training-monitor.service';
import { RunPodTemplatesService } from './services/runpod-templates.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Model, Dataset]),
    SettingsModule,
    SharedModule,
    forwardRef(() => ModelsModule)
  ],
  controllers: [TrainingController],
  providers: [
    RunPodGraphQLService,
    PodSshService,
    TrainingBundleService,
    RunPodOrchestratorService,
    TrainingMonitorService,
    RunPodTemplatesService
  ],
  exports: [RunPodOrchestratorService]
})
export class TrainingModule implements OnModuleDestroy {
  constructor(
    @InjectRepository(Model)
    private modelsRepository: Repository<Model>,
    private runpodGraphQLService: RunPodGraphQLService
  ) {}

  async onModuleDestroy() {
    // Gracefully stop all active pods on shutdown
    try {
      const activeModels = await this.modelsRepository.find({
        where: {
          status: In(['provisioning', 'training', 'uploading'])
        }
      });

      for (const model of activeModels) {
        if (model.runpodPodId) {
          try {
            await this.runpodGraphQLService.stopPod(model.runpodPodId);
            console.log(`Stopped pod ${model.runpodPodId} for model ${model.id}`);
          } catch (error) {
            console.error(`Failed to stop pod ${model.runpodPodId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error during TrainingModule cleanup:', error);
    }
  }
}
