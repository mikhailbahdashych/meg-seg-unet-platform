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

  // U-Net Architecture Parameters
  @Column('int', { name: 'input_channels', default: 3 })
  inputChannels: number;

  @Column('int', { name: 'output_channels', default: 1 })
  outputChannels: number;

  @Column('int', { name: 'base_filters', default: 64 })
  baseFilters: number;

  @Column('int', { default: 4 })
  depth: number;

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

  // RunPod Instance Details (will be populated later when RunPod integration is added)
  @Column({ name: 'runpod_pod_id', nullable: true })
  runpodPodId: string;

  @Column({ name: 'runpod_host', nullable: true })
  runpodHost: string;

  @Column('int', { name: 'runpod_port', nullable: true })
  runpodPort: number;

  @Column({ name: 'runpod_username', nullable: true })
  runpodUsername: string;

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
