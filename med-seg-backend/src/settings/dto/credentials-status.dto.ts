export class CredentialsStatusDto {
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
