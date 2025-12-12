export interface Model {
  id: number;
  name: string;
  datasetId: number;
  s3Bucket: string;
  s3Key: string;

  // U-Net Architecture
  inputChannels: number;
  outputChannels: number;
  baseFilters: number;
  depth: number;

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
