export interface CredentialsStatusDto {
  awsConfigured: boolean;
  awsValidated: boolean;
  awsLastValidatedAt: Date | null;
  awsAccessKeyIdMasked?: string;
  awsRegion?: string;
  awsS3BucketName?: string;

  runpodConfigured: boolean;
  runpodValidated: boolean;
  runpodLastValidatedAt: Date | null;
  runpodApiKeyMasked?: string;
}

export interface UpdateAwsCredentialsDto {
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsS3BucketName: string;
}

export interface UpdateRunpodCredentialsDto {
  runpodApiKey: string;
}
