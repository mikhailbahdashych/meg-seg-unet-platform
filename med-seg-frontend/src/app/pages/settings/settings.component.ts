import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '@services/settings.service';
import { CredentialsStatusDto } from '@interfaces/credentials.interface';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  // AWS Credentials Form
  awsAccessKeyId = '';
  awsSecretAccessKey = '';
  awsRegion = 'us-east-1';
  awsS3BucketName = '';

  // RunPod Credentials Form
  runpodApiKey = '';

  // Status
  credentialsStatus: CredentialsStatusDto | null = null;
  isLoading = true;

  // UI State
  isSavingAws = false;
  isSavingRunpod = false;
  awsSuccessMessage = '';
  awsErrorMessage = '';
  runpodSuccessMessage = '';
  runpodErrorMessage = '';

  constructor(private settingsService: SettingsService) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.isLoading = true;
    this.settingsService.getCredentialsStatus().subscribe({
      next: (status) => {
        this.credentialsStatus = status;
        this.isLoading = false;

        // Pre-fill non-secret fields
        if (status.awsRegion) this.awsRegion = status.awsRegion;
        if (status.awsS3BucketName)
          this.awsS3BucketName = status.awsS3BucketName;
      },
      error: (error) => {
        console.error('Error loading credentials status:', error);
        this.isLoading = false;
      }
    });
  }

  saveAwsCredentials(): void {
    if (!this.canSaveAws()) return;

    this.isSavingAws = true;
    this.awsSuccessMessage = '';
    this.awsErrorMessage = '';

    const credentials = {
      awsAccessKeyId: this.awsAccessKeyId,
      awsSecretAccessKey: this.awsSecretAccessKey,
      awsRegion: this.awsRegion,
      awsS3BucketName: this.awsS3BucketName
    };

    this.settingsService.updateAwsCredentials(credentials).subscribe({
      next: (response) => {
        this.isSavingAws = false;
        if (response.success) {
          this.awsSuccessMessage =
            'AWS credentials saved and validated successfully!';
          // Clear password field for security
          this.awsSecretAccessKey = '';
          // Reload status to show masked credentials
          this.loadStatus();
        } else {
          this.awsErrorMessage =
            response.error || 'Failed to validate AWS credentials';
        }
      },
      error: (error) => {
        console.error('Error saving AWS credentials:', error);
        this.awsErrorMessage =
          error.error?.message || 'Failed to save AWS credentials';
        this.isSavingAws = false;
      }
    });
  }

  saveRunpodCredentials(): void {
    if (!this.canSaveRunpod()) return;

    this.isSavingRunpod = true;
    this.runpodSuccessMessage = '';
    this.runpodErrorMessage = '';

    const credentials = {
      runpodApiKey: this.runpodApiKey
    };

    this.settingsService.updateRunpodCredentials(credentials).subscribe({
      next: (response) => {
        this.isSavingRunpod = false;
        if (response.success) {
          this.runpodSuccessMessage = 'RunPod API key saved successfully!';
          // Clear password field for security
          this.runpodApiKey = '';
          // Reload status to show masked credentials
          this.loadStatus();
        } else {
          this.runpodErrorMessage =
            response.error || 'Failed to validate RunPod API key';
        }
      },
      error: (error) => {
        console.error('Error saving RunPod credentials:', error);
        this.runpodErrorMessage =
          error.error?.message || 'Failed to save RunPod API key';
        this.isSavingRunpod = false;
      }
    });
  }

  canSaveAws(): boolean {
    return (
      this.awsAccessKeyId.trim().length > 0 &&
      this.awsSecretAccessKey.trim().length > 0 &&
      this.awsRegion.trim().length > 0 &&
      this.awsS3BucketName.trim().length > 0 &&
      !this.isSavingAws
    );
  }

  canSaveRunpod(): boolean {
    return this.runpodApiKey.trim().length > 0 && !this.isSavingRunpod;
  }

  formatDate(date: Date | null | undefined): string {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleString();
  }
}
