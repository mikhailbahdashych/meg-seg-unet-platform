import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ModelService } from '@services/model.service';
import { Model } from '@interfaces/model.interface';

@Component({
  selector: 'app-model-details',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './model-details.component.html',
  styleUrls: ['./model-details.component.scss']
})
export class ModelDetailsComponent implements OnInit, OnDestroy {
  model: Model | null = null;
  isLoading = true;
  errorMessage = '';
  pollingInterval: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modelService: ModelService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadModel(+id);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadModel(id: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.modelService.getModel(id).subscribe({
      next: (model) => {
        this.model = model;
        this.isLoading = false;

        // Start polling if model is in active state
        if (this.isActiveStatus(model.status)) {
          this.startPolling();
        } else {
          this.stopPolling();
        }
      },
      error: (error) => {
        console.error('Error loading model:', error);
        this.errorMessage = 'Failed to load model details';
        this.isLoading = false;
      }
    });
  }

  startPolling(): void {
    // Poll every 5 seconds
    this.pollingInterval = setInterval(() => {
      if (this.model) {
        this.modelService.getTrainingStatus(this.model.id).subscribe({
          next: (status) => {
            if (this.model) {
              this.model.status = status.status;
              this.model.errorMessage = status.errorMessage;
              this.model.finalLoss = status.finalLoss;
              this.model.finalDiceScore = status.finalDiceScore;
              this.model.trainingDurationSeconds =
                status.trainingDurationSeconds;
              this.model.startedAt = status.startedAt;
              this.model.completedAt = status.completedAt;

              // Stop polling if no longer in active state
              if (!this.isActiveStatus(this.model.status)) {
                this.stopPolling();
              }
            }
          },
          error: (error) => {
            console.error('Error fetching status:', error);
          }
        });
      }
    }, 5000);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  isActiveStatus(status: string): boolean {
    return ['pending', 'provisioning', 'training', 'uploading'].includes(
      status
    );
  }

  downloadModel(): void {
    if (!this.model) return;

    this.modelService.getDownloadUrl(this.model.id).subscribe({
      next: (response) => {
        window.open(response.url, '_blank');
      },
      error: (error) => {
        console.error('Error getting download URL:', error);
        alert('Failed to download model');
      }
    });
  }

  deleteModel(): void {
    if (!this.model) return;

    if (
      !confirm(
        `Are you sure you want to delete "${this.model.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    this.modelService.deleteModel(this.model.id).subscribe({
      next: () => {
        this.router.navigate(['/models']);
      },
      error: (error) => {
        console.error('Error deleting model:', error);
        alert('Failed to delete model');
      }
    });
  }

  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      pending: 'status-pending',
      provisioning: 'status-provisioning',
      training: 'status-training',
      uploading: 'status-uploading',
      completed: 'status-completed',
      failed: 'status-failed',
      cancelled: 'status-cancelled'
    };
    return statusClasses[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      pending: 'Pending',
      provisioning: 'Provisioning',
      training: 'Training',
      uploading: 'Uploading',
      completed: 'Completed',
      failed: 'Failed',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return 'N/A';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
