export interface ModelTemplate {
  id: number;
  name: string;
  description?: string;

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

  // Timestamps
  createdAt: Date;
}
