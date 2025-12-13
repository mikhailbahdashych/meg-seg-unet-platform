import { Injectable, Logger } from '@nestjs/common';
import { CredentialsService } from '@settings/credentials.service';
import { Model } from '@models/entities/model.entity';
import { Dataset } from '@datasets/entities/dataset.entity';
import * as fs from 'fs';
import * as path from 'path';

interface TrainingConfig {
  dataset_s3_bucket: string;
  dataset_s3_key: string;
  model_s3_bucket: string;
  model_s3_key: string;
  aws_credentials: {
    access_key_id: string;
    secret_access_key: string;
    region: string;
  };
  hyperparameters: {
    input_channels: number;
    output_channels: number;
    base_filters: number;
    depth: number;
    kernel_size: number;
    num_convs_per_block: number;
    pooling_type: string;
    pooling_size: number;
    upsampling_type: string;
    upsampling_size: number;
    use_batch_norm: boolean;
    activation: string;
    dropout_rate: number;
    skip_connections: boolean;
    filter_multiplier: number;
    epochs: number;
    batch_size: number;
    learning_rate: number;
    optimizer: string;
    loss_function: string;
    validation_split: number;
  };
}

@Injectable()
export class TrainingBundleService {
  private readonly logger = new Logger(TrainingBundleService.name);
  private readonly ML_SCRIPTS_DIR = path.join(process.cwd(), '..', 'med-seg-ml');
  private readonly TEMP_BUNDLES_DIR = path.join(
    process.cwd(),
    'temp',
    'training-bundles'
  );

  constructor(private credentialsService: CredentialsService) {
    // Ensure temp directory exists
    if (!fs.existsSync(this.TEMP_BUNDLES_DIR)) {
      fs.mkdirSync(this.TEMP_BUNDLES_DIR, { recursive: true });
    }
  }

  async generateTrainingConfig(
    model: Model,
    dataset: Dataset
  ): Promise<TrainingConfig> {
    const awsCredentials = await this.credentialsService.getAwsCredentials();

    if (!awsCredentials) {
      throw new Error('AWS credentials not configured');
    }

    return {
      dataset_s3_bucket: dataset.s3Bucket,
      dataset_s3_key: dataset.s3Key,
      model_s3_bucket: model.s3Bucket,
      model_s3_key: model.s3Key,
      aws_credentials: {
        access_key_id: awsCredentials.accessKeyId,
        secret_access_key: awsCredentials.secretAccessKey,
        region: awsCredentials.region
      },
      hyperparameters: {
        input_channels: model.inputChannels,
        output_channels: model.outputChannels,
        base_filters: model.baseFilters,
        depth: model.depth,
        kernel_size: model.kernelSize,
        num_convs_per_block: model.numConvsPerBlock,
        pooling_type: model.poolingType,
        pooling_size: model.poolingSize,
        upsampling_type: model.upsamplingType,
        upsampling_size: model.upsamplingSize,
        use_batch_norm: model.useBatchNorm,
        activation: model.activation,
        dropout_rate: model.dropoutRate,
        skip_connections: model.skipConnections,
        filter_multiplier: model.filterMultiplier,
        epochs: model.epochs,
        batch_size: model.batchSize,
        learning_rate: model.learningRate,
        optimizer: model.optimizer,
        loss_function: model.lossFunction,
        validation_split: model.validationSplit
      }
    };
  }

  async createTrainingBundle(model: Model, dataset: Dataset): Promise<string> {
    this.logger.log(`Creating training bundle for model ${model.id}`);

    const bundlePath = path.join(this.TEMP_BUNDLES_DIR, `model-${model.id}`);

    // Create bundle directory
    if (fs.existsSync(bundlePath)) {
      fs.rmSync(bundlePath, { recursive: true, force: true });
    }
    fs.mkdirSync(bundlePath, { recursive: true });

    try {
      // Copy Python files from med-seg-ml directory
      const pythonFiles = [
        'train.py',
        'unet_configurable.py',
        'unet.py',
        'dataset.py',
        'losses.py'
      ];

      for (const file of pythonFiles) {
        const sourcePath = path.join(this.ML_SCRIPTS_DIR, file);
        const destPath = path.join(bundlePath, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, destPath);
          this.logger.log(`Copied ${file} to bundle`);
        } else {
          this.logger.warn(`Python file not found: ${sourcePath}`);
        }
      }

      // Generate training config
      const config = await this.generateTrainingConfig(model, dataset);
      const configPath = path.join(bundlePath, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      this.logger.log('Training config generated');

      // Create install_deps.sh script
      const installScript = `#!/bin/bash
set -e

echo "Installing Python dependencies..."
pip install torch>=2.1.0 torchvision>=0.16.0 numpy>=1.24.0 \\
            pillow>=10.0.0 boto3>=1.28.0 albumentations>=1.3.0 \\
            tqdm>=4.65.0 matplotlib>=3.7.0 scikit-image>=0.21.0

echo "Dependencies installed successfully"
`;

      const installScriptPath = path.join(bundlePath, 'install_deps.sh');
      fs.writeFileSync(installScriptPath, installScript, { mode: 0o755 });
      this.logger.log('Install script created');

      return bundlePath;
    } catch (error) {
      this.logger.error(
        `Error creating training bundle: ${error.message}`,
        error.stack
      );
      // Cleanup on error
      if (fs.existsSync(bundlePath)) {
        fs.rmSync(bundlePath, { recursive: true, force: true });
      }
      throw new Error(`Failed to create training bundle: ${error.message}`);
    }
  }

  async cleanupBundle(bundlePath: string): Promise<void> {
    try {
      if (fs.existsSync(bundlePath)) {
        fs.rmSync(bundlePath, { recursive: true, force: true });
        this.logger.log(`Training bundle cleaned up: ${bundlePath}`);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up bundle: ${error.message}`, error.stack);
      // Don't throw - cleanup failure is not critical
    }
  }
}
