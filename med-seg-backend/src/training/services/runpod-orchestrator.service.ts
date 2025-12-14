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

      // 3. Extract pod ID and machine details
      const podHostId = pod.machine?.podHostId;
      if (!podHostId) {
        throw new Error('Pod host ID not found');
      }

      // 4. Save initial pod details to model entity
      await this.modelsRepository.update(model.id, {
        runpodPodId: pod.id,
        runpodUsername: 'root',
        runpodGpuType: gpuTypeId
      });

      // 5. Wait for pod to be ready
      this.logger.log('Waiting for pod to be ready...');
      await this.waitForPodReady(pod.id, 300); // 5 minute timeout

      // 6. Get pod status with SSH connection details (now that it's ready)
      this.logger.log('Retrieving SSH connection details...');
      const podStatus = await this.runpodGraphQLService.getPodStatus(pod.id);

      this.logger.debug(
        `Pod status response: ${JSON.stringify(podStatus, null, 2)}`
      );

      // Check if runtime and ports exist
      if (!podStatus.runtime) {
        throw new Error('Pod runtime is null - pod may not be fully started');
      }

      if (!podStatus.runtime.ports || podStatus.runtime.ports.length === 0) {
        throw new Error('No ports found in pod runtime');
      }

      this.logger.log(
        `Found ${podStatus.runtime.ports.length} port(s) in pod runtime`
      );

      const sshPort = podStatus.runtime.ports.find((p: any) => p.privatePort === 22);

      if (!sshPort) {
        this.logger.error(
          `Available ports: ${JSON.stringify(podStatus.runtime.ports)}`
        );
        throw new Error('SSH port (privatePort 22) not found in pod runtime');
      }

      this.logger.log(
        `SSH port mapping: ${sshPort.privatePort} -> ${sshPort.publicPort} (${sshPort.ip})`
      );

      // Validate SSH connection details
      if (!sshPort.ip || !sshPort.publicPort) {
        throw new Error(
          `Invalid SSH connection details: ip=${sshPort.ip}, publicPort=${sshPort.publicPort}`
        );
      }

      // 7. Update model with SSH connection details
      await this.modelsRepository.update(model.id, {
        runpodHost: sshPort.ip,
        runpodPort: sshPort.publicPort
      });

      // 8. Connect via SSH first
      this.logger.log('Connecting via SSH to setup training environment...');
      const sshConnection = await this.podSshService.connect(
        sshPort.ip,
        sshPort.publicPort,
        'root',
        podHostId
      );

      // 9. Initialize UV project on the pod
      const projectName = `training-${model.id}`;
      const remoteProjectDir = `/root/${projectName}`;

      this.logger.log('Initializing UV project on pod...');
      this.logger.log(`Running: cd /root && uv init ${projectName} --python 3.12`);

      const uvInitResult = await this.podSshService.executeCommand(
        `cd /root && uv init ${projectName} --python 3.12`,
        sshConnection,
        60000 // 1 minute timeout
      );

      this.logger.log(`UV init completed with exit code: ${uvInitResult.exitCode}`);

      if (uvInitResult.stdout) {
        this.logger.debug(`UV init stdout: ${uvInitResult.stdout}`);
      }

      if (uvInitResult.stderr) {
        this.logger.warn(`UV init stderr: ${uvInitResult.stderr}`);
      }

      if (uvInitResult.exitCode !== 0) {
        throw new Error(`UV project initialization failed: ${uvInitResult.stderr}`);
      }

      // Disconnect before SCP upload
      await this.podSshService.disconnect(sshConnection);

      // 10. Create training bundle
      this.logger.log('Creating training bundle...');
      const bundlePath = await this.trainingBundleService.createTrainingBundle(
        model,
        dataset
      );

      // 11. Upload training files into the UV project directory
      this.logger.log('Uploading training files to UV project...');
      await this.podSshService.uploadDirectory(
        bundlePath,
        remoteProjectDir,
        sshPort.ip,
        sshPort.publicPort,
        'root',
        podHostId
      );

      // 12. Reconnect and install dependencies
      this.logger.log('Reconnecting via SSH to install dependencies...');
      const sshConnection2 = await this.podSshService.connect(
        sshPort.ip,
        sshPort.publicPort,
        'root',
        podHostId
      );

      // Activate venv and install dependencies with UV
      this.logger.log('Installing Python dependencies with UV...');
      const installCommand = `cd ${remoteProjectDir} && source .venv/bin/activate && uv add torch>=2.1.0 torchvision>=0.16.0 numpy>=1.24.0 pillow>=10.0.0 boto3>=1.28.0 albumentations>=1.3.0 tqdm>=4.65.0 matplotlib>=3.7.0 scikit-image>=0.21.0`;
      this.logger.log(`Running: ${installCommand}`);

      const installResult = await this.podSshService.executeCommand(
        installCommand,
        sshConnection2,
        600000 // 10 minutes for package install
      );

      this.logger.log(`Install completed with exit code: ${installResult.exitCode}`);

      if (installResult.stdout) {
        this.logger.debug(`Install stdout: ${installResult.stdout}`);
      }

      if (installResult.stderr) {
        this.logger.warn(`Install stderr: ${installResult.stderr}`);
      }

      if (installResult.exitCode !== 0) {
        throw new Error(`Dependency installation failed: ${installResult.stderr}`);
      }

      // 13. Start training in background with virtual environment
      this.logger.log('Starting training script...');
      const trainCommand = `cd ${remoteProjectDir} && source .venv/bin/activate && mkdir -p /root/output && nohup python train.py --config config.json --download-from-s3 --output-dir /root/output > training.log 2>&1 &`;
      this.logger.log(`Running: ${trainCommand}`);

      const trainResult = await this.podSshService.executeCommand(
        trainCommand,
        sshConnection2,
        10000 // Short timeout since we're running in background
      );

      this.logger.log(`Training command exit code: ${trainResult.exitCode}`);

      if (trainResult.stdout) {
        this.logger.debug(`Training stdout: ${trainResult.stdout}`);
      }

      if (trainResult.stderr) {
        this.logger.debug(`Training stderr: ${trainResult.stderr}`);
      }

      // 14. Update status to training
      await this.modelsService.updateStatus(model.id, 'training');
      this.logger.log(`Training started successfully for model ${model.id}`);

      // 15. Cleanup
      await this.podSshService.disconnect(sshConnection2);
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
        '/root/output/training_status.json',
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
        '/root/output/training_history.json',
        sshConnection
      );
      const history = JSON.parse(historyContent);
      const finalMetrics = history.history[history.history.length - 1];

      // Read training logs
      const logs = await this.podSshService.readRemoteFile(
        `/root/model-${modelId}/training.log`,
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
            `/root/model-${modelId}/training.log`,
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
    let checkCount = 0;

    this.logger.log(
      `Waiting for pod ${podId} to be ready (timeout: ${timeoutSeconds}s)...`
    );

    while (Date.now() - startTime < timeoutMs) {
      try {
        checkCount++;
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

        this.logger.debug(
          `Pod readiness check #${checkCount} (elapsed: ${elapsedSeconds}s)`
        );

        const podStatus = await this.runpodGraphQLService.getPodStatus(podId);

        this.logger.debug(
          `Pod status: desiredStatus=${podStatus.desiredStatus}, runtime=${podStatus.runtime ? 'present' : 'null'}, ports=${podStatus.runtime?.ports?.length || 0}`
        );

        if (
          podStatus.runtime &&
          podStatus.runtime.ports &&
          podStatus.runtime.ports.length > 0
        ) {
          const sshPort = podStatus.runtime.ports.find(
            (p: any) => p.privatePort === 22
          );
          this.logger.log(
            `✅ Pod ${podId} is ready after ${elapsedSeconds}s! SSH available at ${sshPort?.ip}:${sshPort?.publicPort}`
          );
          return;
        }

        this.logger.debug('Pod not ready yet, waiting 5 seconds...');
        // Wait 5 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        this.logger.warn(`Pod readiness check failed: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    throw new Error(
      `Pod ${podId} did not become ready within ${timeoutSeconds} seconds (${checkCount} checks)`
    );
  }
}
