export interface Model {
  id: number;
  name: string;
  datasetId: number;
  s3Bucket: string;
  s3Key: string;

  // U-Net Architecture - Basic
  inputChannels: number;
  outputChannels: number;
  baseFilters: number;
  depth: number;

  // U-Net Architecture - Advanced
  kernelSize: number;
  numConvsPerBlock: number;
  poolingType: 'max' | 'avg' | 'strided_conv';
  poolingSize: number;
  upsamplingType: 'transpose' | 'bilinear' | 'nearest';
  upsamplingSize: number;
  useBatchNorm: boolean;
  activation: 'relu' | 'leaky_relu' | 'elu' | 'selu';
  dropoutRate: number;
  skipConnections: boolean;
  filterMultiplier: number;

  // Training Hyperparameters
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: 'adam' | 'sgd' | 'rmsprop';
  lossFunction: 'dice' | 'bce' | 'focal' | 'combined';
  validationSplit: number;

  // Training Status
  status:
    | 'pending'
    | 'provisioning'
    | 'training'
    | 'uploading'
    | 'completed'
    | 'failed'
    | 'cancelled';
  errorMessage?: string;

  // RunPod Instance Details
  runpodPodId?: string;
  runpodHost?: string;
  runpodPort?: number;
  runpodUsername?: string;
  runpodGpuType?: string;
  runpodTemplateImage?: string;

  // Training Metrics
  finalLoss?: number;
  finalAccuracy?: number;
  finalDiceScore?: number;
  trainingDurationSeconds?: number;
  trainingLogs?: string;

  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Model File Info
  modelSizeMb?: number;

  // Populated relation
  dataset?: any;
}
