export class TrainingStatusDto {
  status: 'training' | 'completed' | 'failed';
  currentEpoch?: number;
  totalEpochs?: number;
  progressPercent?: number;
  currentLoss?: number;
  currentDiceScore?: number;
  errorMessage?: string;
  timestamp: string;
}
