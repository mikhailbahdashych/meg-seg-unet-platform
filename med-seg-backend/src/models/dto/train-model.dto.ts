export class TrainModelDto {
  name: string;
  datasetId: number;

  // U-Net Architecture (optional - will use defaults if not provided)
  inputChannels?: number; // default: 3
  outputChannels?: number; // default: 1
  baseFilters?: number; // default: 64
  depth?: number; // default: 4

  // Training Hyperparameters (optional - will use defaults if not provided)
  epochs?: number; // default: 50
  batchSize?: number; // default: 4
  learningRate?: number; // default: 0.001
  optimizer?: 'adam' | 'sgd' | 'rmsprop'; // default: 'adam'
  lossFunction?: 'dice' | 'bce' | 'focal' | 'combined'; // default: 'dice'
  validationSplit?: number; // default: 0.2
}
