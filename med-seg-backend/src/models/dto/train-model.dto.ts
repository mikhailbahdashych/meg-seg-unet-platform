export class TrainModelDto {
  name: string;
  datasetId: number;
  gpuTypeId: string; // RunPod GPU type identifier (e.g., "NVIDIA RTX A6000")

  // U-Net Architecture - Basic (optional - will use defaults if not provided)
  inputChannels?: number; // default: 3
  outputChannels?: number; // default: 1
  baseFilters?: number; // default: 64
  depth?: number; // default: 4

  // U-Net Architecture - Advanced (optional - will use defaults if not provided)
  kernelSize?: number; // default: 3
  numConvsPerBlock?: number; // default: 2
  poolingType?: 'max' | 'avg' | 'strided_conv'; // default: 'max'
  poolingSize?: number; // default: 2
  upsamplingType?: 'transpose' | 'bilinear' | 'nearest'; // default: 'transpose'
  upsamplingSize?: number; // default: 2
  useBatchNorm?: boolean; // default: true
  activation?: 'relu' | 'leaky_relu' | 'elu' | 'selu'; // default: 'relu'
  dropoutRate?: number; // default: 0.0
  skipConnections?: boolean; // default: true
  filterMultiplier?: number; // default: 2

  // Training Hyperparameters (optional - will use defaults if not provided)
  epochs?: number; // default: 50
  batchSize?: number; // default: 4
  learningRate?: number; // default: 0.001
  optimizer?: 'adam' | 'sgd' | 'rmsprop'; // default: 'adam'
  lossFunction?: 'dice' | 'bce' | 'focal' | 'combined'; // default: 'dice'
  validationSplit?: number; // default: 0.2
}
