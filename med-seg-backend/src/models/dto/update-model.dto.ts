export class UpdateModelDto {
  name?: string;
  status?:
    | 'pending'
    | 'provisioning'
    | 'training'
    | 'uploading'
    | 'completed'
    | 'failed'
    | 'cancelled';
  errorMessage?: string;

  // RunPod details
  runpodPodId?: string;
  runpodHost?: string;
  runpodPort?: number;
  runpodUsername?: string;

  // Training metrics
  finalLoss?: number;
  finalAccuracy?: number;
  finalDiceScore?: number;
  trainingDurationSeconds?: number;
  trainingLogs?: string;

  // Timestamps
  startedAt?: Date;
  completedAt?: Date;

  // Model file info
  modelSizeMb?: number;
}
