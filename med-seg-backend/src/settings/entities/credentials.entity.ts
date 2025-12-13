import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

@Entity('credentials')
export class Credentials {
  @PrimaryGeneratedColumn()
  id: number;

  // AWS Credentials (encrypted)
  @Column({ name: 'aws_access_key_id', nullable: true, type: 'text' })
  awsAccessKeyId: string;

  @Column({ name: 'aws_secret_access_key', nullable: true, type: 'text' })
  awsSecretAccessKey: string;

  @Column({ name: 'aws_region', nullable: true })
  awsRegion: string;

  @Column({ name: 'aws_s3_bucket_name', nullable: true })
  awsS3BucketName: string;

  // RunPod Credentials (encrypted)
  @Column({ name: 'runpod_api_key', nullable: true, type: 'text' })
  runpodApiKey: string;

  // Validation Status
  @Column({ name: 'aws_validated', default: false })
  awsValidated: boolean;

  @Column({ name: 'runpod_validated', default: false })
  runpodValidated: boolean;

  @Column({ name: 'aws_last_validated_at', nullable: true, type: 'datetime' })
  awsLastValidatedAt: Date;

  @Column({ name: 'runpod_last_validated_at', nullable: true, type: 'datetime' })
  runpodLastValidatedAt: Date;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
