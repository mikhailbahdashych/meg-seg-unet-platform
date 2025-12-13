import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Model } from '@models/entities/model.entity';
import { RunPodOrchestratorService } from './runpod-orchestrator.service';

@Injectable()
export class TrainingMonitorService {
  private readonly logger = new Logger(TrainingMonitorService.name);

  constructor(
    @InjectRepository(Model)
    private modelsRepository: Repository<Model>,
    private runpodOrchestratorService: RunPodOrchestratorService
  ) {}

  // Run every 60 seconds for regular training monitoring
  @Cron('*/60 * * * * *')
  async monitorActiveTrainings() {
    this.logger.debug('Checking active training jobs...');

    try {
      const activeModels = await this.modelsRepository.find({
        where: {
          status: In(['provisioning', 'training', 'uploading'])
        }
      });

      if (activeModels.length === 0) {
        this.logger.debug('No active training jobs');
        return;
      }

      this.logger.log(`Monitoring ${activeModels.length} active training jobs`);

      for (const model of activeModels) {
        try {
          await this.runpodOrchestratorService.monitorTraining(model.id);
        } catch (error) {
          this.logger.error(
            `Error monitoring training for model ${model.id}: ${error.message}`,
            error.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in monitorActiveTrainings: ${error.message}`,
        error.stack
      );
    }
  }

  // Run every 10 seconds for models in uploading state (more critical)
  @Cron('*/10 * * * * *')
  async monitorUploadingModels() {
    try {
      const uploadingModels = await this.modelsRepository.find({
        where: { status: 'uploading' }
      });

      for (const model of uploadingModels) {
        try {
          await this.runpodOrchestratorService.monitorTraining(model.id);
        } catch (error) {
          this.logger.error(
            `Error monitoring upload for model ${model.id}: ${error.message}`,
            error.stack
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in monitorUploadingModels: ${error.message}`,
        error.stack
      );
    }
  }
}
