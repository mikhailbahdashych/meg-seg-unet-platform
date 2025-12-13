import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Model } from '@models/entities/model.entity';
import { Dataset } from '@datasets/entities/dataset.entity';
import { RunPodGraphQLService } from './runpod-graphql.service';
import { PodSshService } from './pod-ssh.service';
import { TrainingBundleService } from './training-bundle.service';
import { S3Service } from '@shared/services/s3.service';
import { ModelsService } from '@models/models.service';

@Injectable()
export class RunPodOrchestratorService {
  private readonly logger = new Logger(RunPodOrchestratorService.name);

  constructor(
    @InjectRepository(Model)
    private modelsRepository: Repository<Model>,
    @InjectRepository(Dataset)
    private datasetsRepository: Repository<Dataset>,
    private runpodGraphQLService: RunPodGraphQLService,
    private podSshService: PodSshService,
    private trainingBundleService: TrainingBundleService,
    private s3Service: S3Service,
    @Inject(forwardRef(() => ModelsService))
    private modelsService: ModelsService
  ) {}

  async startTraining(
    model: Model,
    dataset: Dataset,
    gpuTypeId: string
  ): Promise<void> {
    this.logger.log(
      `Starting training for model ${model.id} on GPU type ${gpuTypeId}`
    );

    try {
      // 1. Update status to provisioning
      await this.modelsService.updateStatus(model.id, 'provisioning');

      // 2. Deploy RunPod pod
      this.logger.log('Deploying RunPod pod...');
      const pod = await this.runpodGraphQLService.deployOnDemandPod({
        gpuTypeId,
        name: `unet-training-${model.id}`
      });

      // 3. Extract SSH connection details
      const sshPort = pod.runtime?.ports?.find((p: any) => p.privatePort === 22);
      if (!sshPort) {
        throw new Error('SSH port not found in pod runtime');
      }

      const podHostId = pod.machine?.podHostId;
      if (!podHostId) {
        throw new Error('Pod host ID not found');
      }

      // 4. Save pod details to model entity
      await this.modelsRepository.update(model.id, {
        runpodPodId: pod.id,
        runpodHost: sshPort.ip,
        runpodPort: sshPort.publicPort,
        runpodUsername: 'root',
        runpodGpuType: gpuTypeId
      });

      // 5. Wait for pod to be ready
      this.logger.log('Waiting for pod to be ready...');
      await this.waitForPodReady(pod.id, 300); // 5 minute timeout

      // 6. Create training bundle
      this.logger.log('Creating training bundle...');
      const bundlePath = await this.trainingBundleService.createTrainingBundle(
        model,
        dataset
      );

      // 7. Upload training bundle via SCP
      this.logger.log('Uploading training bundle to pod...');
      await this.podSshService.uploadDirectory(
        bundlePath,
        '/workspace/training',
        sshPort.ip,
        sshPort.publicPort,
        'root',
        podHostId
      );

      // 8. Connect via SSH and install dependencies
      this.logger.log('Connecting via SSH to install dependencies...');
      const sshConnection = await this.podSshService.connect(
        sshPort.ip,
        sshPort.publicPort,
        'root',
        podHostId
      );

      // Install dependencies
      this.logger.log('Installing Python dependencies...');
      const installResult = await this.podSshService.executeCommand(
        'cd /workspace/training && bash install_deps.sh',
        sshConnection,
        600000 // 10 minutes for pip install
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`Dependency installation failed: ${installResult.stderr}`);
      }

      // 9. Start training in background
      this.logger.log('Starting training script...');
      await this.podSshService.executeCommand(
        'cd /workspace/training && nohup python train.py --config config.json --download-from-s3 --output-dir /workspace/output > training.log 2>&1 &',
        sshConnection,
        10000 // Short timeout since we're running in background
      );

      // 10. Update status to training
      await this.modelsService.updateStatus(model.id, 'training');
      this.logger.log(`Training started successfully for model ${model.id}`);

      // 11. Cleanup
      await this.podSshService.disconnect(sshConnection);
      await this.trainingBundleService.cleanupBundle(bundlePath);
    } catch (error) {
      this.logger.error(
        `Error starting training for model ${model.id}: ${error.message}`,
        error.stack
      );
      await this.handleTrainingFailure(model.id, error);
      throw error;
    }
  }

  async monitorTraining(modelId: number): Promise<any> {
    const model = await this.modelsRepository.findOne({ where: { id: modelId } });

    if (!model || !model.runpodPodId) {
      this.logger.warn(`Model ${modelId} does not have RunPod pod ID`);
      return null;
    }

    try {
      // Connect to pod
      const sshConnection = await this.podSshService.connect(
        model.runpodHost!,
        model.runpodPort!,
        model.runpodUsername || 'root',
        model.runpodPodId
      );

      // Read training status file
      const statusContent = await this.podSshService.readRemoteFile(
        '/workspace/output/training_status.json',
        sshConnection
      );

      const status = JSON.parse(statusContent);

      // Update model with current metrics
      await this.modelsRepository.update(modelId, {
        currentEpoch: status.current_epoch,
        currentLoss: status.current_loss,
        currentDiceScore: status.current_dice_score,
        progressPercent: status.progress_percent
      });

      await this.podSshService.disconnect(sshConnection);

      // If training completed, trigger completion handler
      if (status.status === 'completed') {
        await this.handleTrainingCompletion(modelId);
      } else if (status.status === 'failed') {
        await this.handleTrainingFailure(
          modelId,
          new Error(status.error_message || 'Training failed')
        );
      }

      return status;
    } catch (error) {
      this.logger.error(
        `Error monitoring training for model ${modelId}: ${error.message}`
      );
      // Don't throw - monitoring failures should not stop the polling
      return null;
    }
  }

  async handleTrainingCompletion(modelId: number): Promise<void> {
    this.logger.log(`Handling training completion for model ${modelId}`);

    const model = await this.modelsRepository.findOne({ where: { id: modelId } });

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    try {
      // Update status to uploading
      await this.modelsService.updateStatus(modelId, 'uploading');

      // Connect to pod
      const sshConnection = await this.podSshService.connect(
        model.runpodHost!,
        model.runpodPort!,
        model.runpodUsername || 'root',
        model.runpodPodId!
      );

      // Read training history for final metrics
      const historyContent = await this.podSshService.readRemoteFile(
        '/workspace/output/training_history.json',
        sshConnection
      );
      const history = JSON.parse(historyContent);
      const finalMetrics = history.history[history.history.length - 1];

      // Read training logs
      const logs = await this.podSshService.readRemoteFile(
        '/workspace/training/training.log',
        sshConnection
      );

      // Disconnect
      await this.podSshService.disconnect(sshConnection);

      // Wait a bit for S3 upload to complete (training script uploads the model)
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds

      // Update model with final metrics
      const updateData: any = {
        finalLoss: finalMetrics.val_loss,
        finalDiceScore: finalMetrics.dice_score,
        trainingLogs: logs.substring(Math.max(0, logs.length - 10000)) // Last 10KB
      };

      // Calculate training duration
      if (model.startedAt) {
        const durationSeconds = Math.floor(
          (new Date().getTime() - model.startedAt.getTime()) / 1000
        );
        updateData.trainingDurationSeconds = durationSeconds;
      }

      await this.modelsRepository.update(modelId, updateData);

      // Update status to completed
      await this.modelsService.updateStatus(modelId, 'completed');
      this.logger.log(`Training completed successfully for model ${modelId}`);

      // Terminate pod
      await this.runpodGraphQLService.terminatePod(model.runpodPodId!);
      this.logger.log(`Pod terminated for model ${modelId}`);
    } catch (error) {
      this.logger.error(
        `Error handling training completion for model ${modelId}: ${error.message}`,
        error.stack
      );
      await this.handleTrainingFailure(modelId, error);
    }
  }

  async handleTrainingFailure(modelId: number, error: Error): Promise<void> {
    this.logger.error(
      `Handling training failure for model ${modelId}: ${error.message}`
    );

    const model = await this.modelsRepository.findOne({ where: { id: modelId } });

    try {
      // Try to read logs from pod if possible
      if (model?.runpodPodId && model.runpodHost && model.runpodPort) {
        try {
          const sshConnection = await this.podSshService.connect(
            model.runpodHost,
            model.runpodPort,
            model.runpodUsername || 'root',
            model.runpodPodId,
            2 // Only 2 retries for failures
          );

          const logs = await this.podSshService.readRemoteFile(
            '/workspace/training/training.log',
            sshConnection
          );

          await this.podSshService.disconnect(sshConnection);

          await this.modelsRepository.update(modelId, {
            trainingLogs: logs.substring(Math.max(0, logs.length - 10000))
          });
        } catch (logError) {
          this.logger.warn(`Could not retrieve logs: ${logError.message}`);
        }

        // Terminate pod
        try {
          await this.runpodGraphQLService.terminatePod(model.runpodPodId);
          this.logger.log(`Pod terminated after failure for model ${modelId}`);
        } catch (terminateError) {
          this.logger.error(`Failed to terminate pod: ${terminateError.message}`);
        }
      }

      // Update status to failed
      await this.modelsService.updateStatus(modelId, 'failed', error.message);
    } catch (cleanupError) {
      this.logger.error(
        `Error during failure cleanup: ${cleanupError.message}`,
        cleanupError.stack
      );
    }
  }

  async terminatePod(modelId: number): Promise<void> {
    const model = await this.modelsRepository.findOne({ where: { id: modelId } });

    if (!model || !model.runpodPodId) {
      this.logger.warn(`Model ${modelId} does not have RunPod pod ID`);
      return;
    }

    try {
      await this.runpodGraphQLService.terminatePod(model.runpodPodId);
      this.logger.log(`Pod terminated for model ${modelId}`);
    } catch (error) {
      this.logger.error(
        `Error terminating pod for model ${modelId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async waitForPodReady(
    podId: string,
    timeoutSeconds: number
  ): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const podStatus = await this.runpodGraphQLService.getPodStatus(podId);

        if (podStatus.runtime && podStatus.runtime.ports) {
          this.logger.log(`Pod ${podId} is ready`);
          return;
        }

        // Wait 5 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        this.logger.warn(`Pod not ready yet: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error(
      `Pod ${podId} did not become ready within ${timeoutSeconds} seconds`
    );
  }
}
