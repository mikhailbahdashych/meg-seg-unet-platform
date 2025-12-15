import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { ModelService } from '@services/model.service';
import { Model } from '@interfaces/model.interface';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CardComponent } from '@shared/components/card/card.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '@shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-models',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule,
    ButtonComponent,
    CardComponent,
    BadgeComponent,
    EmptyStateComponent,
    SkeletonComponent
  ],
  templateUrl: './models.component.html',
  styleUrls: ['./models.component.scss']
})
export class ModelsComponent implements OnInit {
  models: Model[] = [];
  filteredModels: Model[] = [];
  isLoading = true;
  errorMessage = '';
  selectedStatus: string = 'all';
  selectedModelIds: Set<number> = new Set();
  isSelectionMode = false;

  constructor(
    private modelService: ModelService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadModels();
  }

  loadModels(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.modelService.getAllModels().subscribe({
      next: (models) => {
        this.models = models;
        this.filterModels();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading models:', error);
        this.errorMessage = 'Failed to load models';
        this.isLoading = false;
      }
    });
  }

  filterModels(): void {
    if (this.selectedStatus === 'all') {
      this.filteredModels = this.models;
    } else {
      this.filteredModels = this.models.filter(
        (m) => m.status === this.selectedStatus
      );
    }
  }

  onStatusFilterChange(status: string): void {
    this.selectedStatus = status;
    this.filterModels();
  }

  viewModelDetails(modelId: number): void {
    this.router.navigate(['/models', modelId]);
  }

  deleteModel(model: Model, event: Event): void {
    event.stopPropagation();

    if (
      !confirm(
        `Are you sure you want to delete "${model.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    this.modelService.deleteModel(model.id).subscribe({
      next: () => {
        this.models = this.models.filter((m) => m.id !== model.id);
        this.filterModels();
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
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  getModelCount(status?: string): number {
    if (!status || status === 'all') {
      return this.models.length;
    }
    return this.models.filter((m) => m.status === status).length;
  }

  toggleSelectionMode(): void {
    this.isSelectionMode = !this.isSelectionMode;
    if (!this.isSelectionMode) {
      this.selectedModelIds.clear();
    }
  }

  toggleModelSelection(modelId: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedModelIds.has(modelId)) {
      this.selectedModelIds.delete(modelId);
    } else {
      this.selectedModelIds.add(modelId);
    }
  }

  isModelSelected(modelId: number): boolean {
    return this.selectedModelIds.has(modelId);
  }

  selectAll(): void {
    this.filteredModels.forEach((model) => this.selectedModelIds.add(model.id));
  }

  deselectAll(): void {
    this.selectedModelIds.clear();
  }

  bulkDelete(): void {
    if (this.selectedModelIds.size === 0) {
      alert('Please select models to delete');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${this.selectedModelIds.size} model(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    const idsArray = Array.from(this.selectedModelIds);

    this.modelService.bulkDeleteModels(idsArray).subscribe({
      next: (result) => {
        this.models = this.models.filter((m) => !idsArray.includes(m.id));
        this.filterModels();
        this.selectedModelIds.clear();
        this.isSelectionMode = false;

        if (result.failed.length > 0) {
          alert(
            `Deleted ${result.deleted} model(s). Failed to delete ${result.failed.length} model(s).`
          );
        } else {
          alert(`Successfully deleted ${result.deleted} model(s)`);
        }
      },
      error: (error) => {
        console.error('Error bulk deleting models:', error);
        alert('Failed to delete models');
      }
    });
  }
}
