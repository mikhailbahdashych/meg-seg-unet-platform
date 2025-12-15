import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from './entities/model.entity';
import { Dataset } from '../datasets/entities/dataset.entity';
import { TrainModelDto } from './dto/train-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { S3Service } from '../shared/services/s3.service';
import { ApiConfigService } from '../shared/services/api-config.service';
import { RunPodOrchestratorService } from '../training/services/runpod-orchestrator.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ModelsService {
  constructor(
    @InjectRepository(Model)
    private modelsRepository: Repository<Model>,
    @InjectRepository(Dataset)
    private datasetsRepository: Repository<Dataset>,
    private s3Service: S3Service,
    private apiConfigService: ApiConfigService,
    @Inject(forwardRef(() => RunPodOrchestratorService))
    private runpodOrchestratorService: RunPodOrchestratorService
  ) {}

  async findAll(): Promise<Model[]> {
    return this.modelsRepository.find({
      order: {
        createdAt: 'DESC'
      },
      relations: ['dataset']
    });
  }

  async findOne(id: number): Promise<Model> {
    const model = await this.modelsRepository.findOne({
      where: { id },
      relations: ['dataset']
    });

    if (!model) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }

    return model;
  }

  async findByDataset(datasetId: number): Promise<Model[]> {
    return this.modelsRepository.find({
      where: { datasetId },
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async createTrainingJob(trainModelDto: TrainModelDto): Promise<Model> {
    // Validate dataset exists and is ready
    const dataset = await this.datasetsRepository.findOne({
      where: { id: trainModelDto.datasetId }
    });

    if (!dataset) {
      throw new NotFoundException(
        `Dataset with ID ${trainModelDto.datasetId} not found`
      );
    }

    if (dataset.status !== 'ready') {
      throw new BadRequestException(
        `Dataset is not ready. Current status: ${dataset.status}`
      );
    }

    // Generate UUID for model storage
    const modelUuid = uuidv4();
    const s3Key = `models/${modelUuid}/model.pth`;

    // Create model record with status='pending'
    const model = this.modelsRepository.create({
      name: trainModelDto.name,
      datasetId: trainModelDto.datasetId,
      s3Bucket: this.apiConfigService.awsS3BucketName,
      s3Key: s3Key,

      // U-Net architecture - Basic (demo-optimized defaults)
      inputChannels: trainModelDto.inputChannels || 1,
      outputChannels: trainModelDto.outputChannels || 1,
      baseFilters: trainModelDto.baseFilters || 32,
      depth: trainModelDto.depth || 3,

      // U-Net architecture - Advanced
      kernelSize: trainModelDto.kernelSize || 3,
      numConvsPerBlock: trainModelDto.numConvsPerBlock || 2,
      poolingType: trainModelDto.poolingType || 'max',
      poolingSize: trainModelDto.poolingSize || 2,
      upsamplingType: trainModelDto.upsamplingType || 'transpose',
      upsamplingSize: trainModelDto.upsamplingSize || 2,
      useBatchNorm:
        trainModelDto.useBatchNorm !== undefined ? trainModelDto.useBatchNorm : true,
      activation: trainModelDto.activation || 'relu',
      dropoutRate: trainModelDto.dropoutRate || 0.0,
      skipConnections:
        trainModelDto.skipConnections !== undefined
          ? trainModelDto.skipConnections
          : true,
      filterMultiplier: trainModelDto.filterMultiplier || 2,

      // Training hyperparameters (demo-optimized defaults)
      epochs: trainModelDto.epochs || 20,
      batchSize: trainModelDto.batchSize || 8,
      learningRate: trainModelDto.learningRate || 0.001,
      optimizer: trainModelDto.optimizer || 'adam',
      lossFunction: trainModelDto.lossFunction || 'dice',
      validationSplit: trainModelDto.validationSplit || 0.2,

      status: 'pending'
    });

    const savedModel = await this.modelsRepository.save(model);

    // START TRAINING ON RUNPOD (async - don't wait)
    this.runpodOrchestratorService
      .startTraining(
        savedModel,
        dataset,
        trainModelDto.gpuTypeId,
        trainModelDto.templateImageName
      )
      .catch((error) => {
        console.error(`Failed to start training for model ${savedModel.id}:`, error);
        this.updateStatus(savedModel.id, 'failed', error.message);
      });

    return savedModel;
  }

  async update(id: number, updateModelDto: UpdateModelDto): Promise<Model> {
    const model = await this.findOne(id);

    // Update fields
    Object.assign(model, updateModelDto);

    return this.modelsRepository.save(model);
  }

  async updateStatus(
    id: number,
    status: Model['status'],
    errorMessage?: string
  ): Promise<Model> {
    const model = await this.findOne(id);

    model.status = status;
    if (errorMessage) {
      model.errorMessage = errorMessage;
    }

    if (status === 'training' && !model.startedAt) {
      model.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      model.completedAt = new Date();

      if (model.startedAt) {
        const duration =
          (model.completedAt.getTime() - model.startedAt.getTime()) / 1000;
        model.trainingDurationSeconds = Math.round(duration);
      }
    }

    return this.modelsRepository.save(model);
  }

  async getDownloadUrl(id: number): Promise<string> {
    const model = await this.findOne(id);

    if (model.status !== 'completed') {
      throw new BadRequestException('Model training is not completed yet');
    }

    // Generate pre-signed URL for download (valid for 1 hour)
    const url = await this.s3Service.getPresignedDownloadUrl(model.s3Key, 3600);
    return url;
  }

  async getTrainingHistory(id: number): Promise<any> {
    const model = await this.findOne(id);

    // If model is currently training, fetch history from the pod
    if (['provisioning', 'training', 'uploading'].includes(model.status)) {
      try {
        const history = await this.runpodOrchestratorService.getTrainingHistory(id);
        return history;
      } catch (error) {
        console.error(
          `Error fetching training history from pod for model ${id}:`,
          error
        );
        throw new NotFoundException('Training history not yet available');
      }
    }

    // If model is completed, fetch history from S3
    if (model.status === 'completed') {
      const historyS3Key = model.s3Key.replace('.pth', '_history.json');

      try {
        // Download training history JSON from S3
        const historyData = await this.s3Service.downloadFileAsString(historyS3Key);
        return JSON.parse(historyData);
      } catch (error) {
        console.error(
          `Error fetching training history from S3 for model ${id}:`,
          error
        );
        throw new NotFoundException('Training history not found');
      }
    }

    throw new BadRequestException(
      `Training history is not available for models with status: ${model.status}`
    );
  }

  async cancelTraining(id: number): Promise<Model> {
    const model = await this.findOne(id);

    // Only cancel if training is in progress
    if (!['provisioning', 'training', 'uploading'].includes(model.status)) {
      throw new BadRequestException(
        `Cannot cancel training. Model status is '${model.status}'`
      );
    }

    // Terminate the RunPod pod
    if (model.runpodPodId) {
      try {
        await this.runpodOrchestratorService.terminatePod(id);
        console.log(`Terminated RunPod pod ${model.runpodPodId} for model ${id}`);
      } catch (error) {
        console.error('Error terminating RunPod pod:', error);
        // Continue with status update even if pod termination fails
      }
    }

    // Update status to cancelled
    return this.updateStatus(id, 'cancelled', 'Training cancelled by user');
  }

  async delete(id: number): Promise<void> {
    const model = await this.findOne(id);

    // Terminate active RunPod pod if training is in progress
    if (
      model.runpodPodId &&
      ['provisioning', 'training', 'uploading'].includes(model.status)
    ) {
      try {
        await this.runpodOrchestratorService.terminatePod(id);
        console.log(`Terminated RunPod pod ${model.runpodPodId} for model ${id}`);
      } catch (error) {
        console.error('Error terminating RunPod pod:', error);
        // Continue with deletion even if pod termination fails
      }
    }

    // Delete from S3 if model was completed
    if (model.status === 'completed') {
      try {
        const modelDir = model.s3Key.substring(0, model.s3Key.lastIndexOf('/'));
        await this.s3Service.deleteDirectory(modelDir);
      } catch (error) {
        console.error('Error deleting model from S3:', error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    await this.modelsRepository.remove(model);
  }

  async bulkDelete(ids: number[]): Promise<{ deleted: number; failed: number[] }> {
    const failedIds: number[] = [];
    let deletedCount = 0;

    for (const id of ids) {
      try {
        await this.delete(id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete model ${id}:`, error.message);
        failedIds.push(id);
      }
    }

    return {
      deleted: deletedCount,
      failed: failedIds
    };
  }

  async getTrainingStatus(id: number): Promise<any> {
    const model = await this.findOne(id);

    // For active trainings, fetch live status from RunPod
    if (['provisioning', 'training', 'uploading'].includes(model.status)) {
      try {
        const liveStatus = await this.runpodOrchestratorService.monitorTraining(id);
        if (liveStatus) {
          return liveStatus;
        }
      } catch (error) {
        console.error('Error fetching live status:', error);
        // Fall back to database status
      }
    }

    // Return database status for completed/failed/cancelled
    return {
      status: model.status,
      errorMessage: model.errorMessage,
      finalLoss: model.finalLoss,
      finalDiceScore: model.finalDiceScore,
      trainingDurationSeconds: model.trainingDurationSeconds,
      startedAt: model.startedAt,
      completedAt: model.completedAt
    };
  }
}
