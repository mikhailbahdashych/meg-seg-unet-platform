import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Dataset } from '../../datasets/entities/dataset.entity';

@Entity('models')
export class Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // Relationship with Dataset
  @Column({ name: 'dataset_id' })
  datasetId: number;

  @ManyToOne(() => Dataset)
  @JoinColumn({ name: 'dataset_id' })
  dataset: Dataset;

  // S3 Storage
  @Column({ name: 's3_bucket' })
  s3Bucket: string;

  @Column({ name: 's3_key' })
  s3Key: string;

  // U-Net Architecture Parameters - Basic
  @Column('int', { name: 'input_channels', default: 3 })
  inputChannels: number;

  @Column('int', { name: 'output_channels', default: 1 })
  outputChannels: number;

  @Column('int', { name: 'base_filters', default: 64 })
  baseFilters: number;

  @Column('int', { default: 4 })
  depth: number;

  // U-Net Architecture Parameters - Advanced
  @Column('int', { name: 'kernel_size', default: 3 })
  kernelSize: number;

  @Column('int', { name: 'num_convs_per_block', default: 2 })
  numConvsPerBlock: number;

  @Column({ name: 'pooling_type', default: 'max' })
  poolingType: 'max' | 'avg' | 'strided_conv';

  @Column('int', { name: 'pooling_size', default: 2 })
  poolingSize: number;

  @Column({ name: 'upsampling_type', default: 'transpose' })
  upsamplingType: 'transpose' | 'bilinear' | 'nearest';

  @Column('int', { name: 'upsampling_size', default: 2 })
  upsamplingSize: number;

  @Column({ name: 'use_batch_norm', default: true })
  useBatchNorm: boolean;

  @Column({ default: 'relu' })
  activation: 'relu' | 'leaky_relu' | 'elu' | 'selu';

  @Column('real', { name: 'dropout_rate', default: 0.0 })
  dropoutRate: number;

  @Column({ name: 'skip_connections', default: true })
  skipConnections: boolean;

  @Column('int', { name: 'filter_multiplier', default: 2 })
  filterMultiplier: number;

  // Training Hyperparameters
  @Column('int', { default: 50 })
  epochs: number;

  @Column('int', { name: 'batch_size', default: 4 })
  batchSize: number;

  @Column('real', { name: 'learning_rate', default: 0.001 })
  learningRate: number;

  @Column({ default: 'adam' })
  optimizer: 'adam' | 'sgd' | 'rmsprop';

  @Column({ name: 'loss_function', default: 'dice' })
  lossFunction: 'dice' | 'bce' | 'focal' | 'combined';

  @Column('real', { name: 'validation_split', default: 0.2 })
  validationSplit: number;

  // Training Status
  @Column({ default: 'pending' })
  status:
    | 'pending'
    | 'provisioning'
    | 'training'
    | 'uploading'
    | 'completed'
    | 'failed'
    | 'cancelled';

  @Column('text', { name: 'error_message', nullable: true })
  errorMessage: string;

  // RunPod Instance Details
  @Column({ name: 'runpod_pod_id', nullable: true })
  runpodPodId: string;

  @Column({ name: 'runpod_host', nullable: true })
  runpodHost: string;

  @Column('int', { name: 'runpod_port', nullable: true })
  runpodPort: number;

  @Column({ name: 'runpod_username', nullable: true })
  runpodUsername: string;

  @Column({ name: 'runpod_gpu_type', nullable: true })
  runpodGpuType: string;

  @Column('real', { name: 'runpod_cost_per_hour', nullable: true })
  runpodCostPerHour: number;

  // Real-time Training Progress
  @Column('int', { name: 'current_epoch', nullable: true })
  currentEpoch: number;

  @Column('real', { name: 'current_loss', nullable: true })
  currentLoss: number;

  @Column('real', { name: 'current_dice_score', nullable: true })
  currentDiceScore: number;

  @Column('int', { name: 'progress_percent', nullable: true })
  progressPercent: number;

  // Training Metrics
  @Column('real', { name: 'final_loss', nullable: true })
  finalLoss: number;

  @Column('real', { name: 'final_accuracy', nullable: true })
  finalAccuracy: number;

  @Column('real', { name: 'final_dice_score', nullable: true })
  finalDiceScore: number;

  @Column('int', { name: 'training_duration_seconds', nullable: true })
  trainingDurationSeconds: number;

  @Column('text', { name: 'training_logs', nullable: true })
  trainingLogs: string;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'started_at', nullable: true, type: 'datetime' })
  startedAt: Date;

  @Column({ name: 'completed_at', nullable: true, type: 'datetime' })
  completedAt: Date;

  // Model File Info
  @Column('real', { name: 'model_size_mb', nullable: true })
  modelSizeMb: number;
}
