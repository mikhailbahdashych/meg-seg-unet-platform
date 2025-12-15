import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('model_templates')
export class ModelTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

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

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
