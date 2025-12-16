import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModelService } from '@services/model.service';
import { Model } from '@interfaces/model.interface';
import { Chart, registerables } from 'chart.js';
import { UnetVisualizerComponent } from '../../components/unet-visualizer/unet-visualizer.component';
import { ModelTemplateService } from '@services/model-template.service';
import { SaveTemplateModalComponent } from '../../components/save-template-modal/save-template-modal.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CardComponent } from '@shared/components/card/card.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';

Chart.register(...registerables);

@Component({
  selector: 'app-model-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    UnetVisualizerComponent,
    SaveTemplateModalComponent,
    ButtonComponent,
    CardComponent,
    BadgeComponent
  ],
  templateUrl: './model-details.component.html',
  styleUrls: ['./model-details.component.scss']
})
export class ModelDetailsComponent implements OnInit, OnDestroy {
  model: Model | null = null;
  isLoading = true;
  errorMessage = '';
  pollingInterval: any;
  trainingStatus: any = null;
  trainingHistory: any = null;
  lossChart: Chart | null = null;
  diceChart: Chart | null = null;

  @ViewChild('lossChartCanvas') lossChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('diceChartCanvas') diceChartCanvas!: ElementRef<HTMLCanvasElement>;

  showSaveTemplateDialog = false;
  newTemplateName = '';
  newTemplateDescription = '';
  savingTemplate = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modelService: ModelService,
    private modelTemplateService: ModelTemplateService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadModel(+id);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroyCharts();
  }

  destroyCharts(): void {
    if (this.lossChart) {
      this.lossChart.destroy();
      this.lossChart = null;
    }
    if (this.diceChart) {
      this.diceChart.destroy();
      this.diceChart = null;
    }
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

        // Load training history if model is completed or training
        if (model.status === 'completed' || model.status === 'training') {
          this.loadTrainingHistory(id);
        }
      },
      error: (error) => {
        console.error('Error loading model:', error);
        this.errorMessage = 'Failed to load model details';
        this.isLoading = false;
      }
    });
  }

  loadTrainingHistory(id: number): void {
    this.modelService.getTrainingHistory(id).subscribe({
      next: (history) => {
        this.trainingHistory = history;
        setTimeout(() => this.renderCharts(), 100);
      },
      error: (error) => {
        console.error('Error loading training history:', error);
      }
    });
  }

  renderCharts(): void {
    if (!this.trainingHistory || !this.trainingHistory.history) {
      return;
    }

    const history = this.trainingHistory.history;
    const epochs = history.map((h: any) => h.epoch);
    const trainLoss = history.map((h: any) => h.train_loss);
    const valLoss = history.map((h: any) => h.val_loss);
    const diceScore = history.map((h: any) => h.dice_score);

    // If charts exist, update their data
    if (this.lossChart && this.diceChart) {
      this.lossChart.data.labels = epochs;
      this.lossChart.data.datasets[0].data = trainLoss;
      this.lossChart.data.datasets[1].data = valLoss;
      this.lossChart.update();

      this.diceChart.data.labels = epochs;
      this.diceChart.data.datasets[0].data = diceScore;
      this.diceChart.update();

      return;
    }

    // Otherwise, create new charts
    this.destroyCharts();

    // Render Loss Chart
    if (this.lossChartCanvas && this.lossChartCanvas.nativeElement) {
      this.lossChart = new Chart(this.lossChartCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: epochs,
          datasets: [
            {
              label: 'Training Loss',
              data: trainLoss,
              borderColor: '#3f51b5',
              backgroundColor: 'rgba(63, 81, 181, 0.1)',
              tension: 0.4,
              fill: true
            },
            {
              label: 'Validation Loss',
              data: valLoss,
              borderColor: '#ff5722',
              backgroundColor: 'rgba(255, 87, 34, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Training and Validation Loss'
            },
            legend: {
              position: 'top'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Epoch'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Loss'
              },
              beginAtZero: false
            }
          }
        }
      });
    }

    // Render Dice Score Chart
    if (this.diceChartCanvas && this.diceChartCanvas.nativeElement) {
      this.diceChart = new Chart(this.diceChartCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: epochs,
          datasets: [
            {
              label: 'Dice Score',
              data: diceScore,
              borderColor: '#4caf50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              tension: 0.4,
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Dice Score Over Epochs'
            },
            legend: {
              position: 'top'
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Epoch'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Dice Score'
              },
              beginAtZero: false,
              max: 1.0
            }
          }
        }
      });
    }
  }

  startPolling(): void {
    // Load status immediately
    this.loadTrainingStatus();

    // Poll every 10 seconds for real-time updates
    this.pollingInterval = setInterval(() => {
      this.loadTrainingStatus();
    }, 10000);
  }

  loadTrainingStatus(): void {
    if (!this.model) return;

    this.modelService.getTrainingStatus(this.model.id).subscribe({
      next: (status) => {
        this.trainingStatus = status;

        // Update model status if changed
        if (this.model && status.status !== this.model.status) {
          this.loadModel(this.model.id);
        }

        // Refresh training history if model is training
        if (this.model && this.model.status === 'training') {
          this.loadTrainingHistory(this.model.id);
        }

        // Stop polling if no longer in active state
        if (!this.isActiveStatus(status.status)) {
          this.stopPolling();
        }
      },
      error: (error) => {
        console.error('Error fetching training status:', error);
      }
    });
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

  cancelTraining(): void {
    if (!this.model) return;

    if (
      !confirm(
        `Are you sure you want to cancel training for "${this.model.name}"? The pod will be terminated.`
      )
    ) {
      return;
    }

    this.modelService.cancelTraining(this.model.id).subscribe({
      next: (updatedModel) => {
        this.model = updatedModel;
        this.stopPolling();
      },
      error: (error) => {
        console.error('Error cancelling training:', error);
        alert(error.error?.message || 'Failed to cancel training');
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

  formatPoolingType(type: string): string {
    const types: { [key: string]: string } = {
      max: 'Max Pooling',
      avg: 'Average Pooling',
      strided_conv: 'Strided Convolution'
    };
    return types[type] || type;
  }

  formatUpsamplingType(type: string): string {
    const types: { [key: string]: string } = {
      transpose: 'Transpose Convolution',
      bilinear: 'Bilinear Interpolation',
      nearest: 'Nearest Neighbor'
    };
    return types[type] || type;
  }

  formatActivation(activation: string): string {
    const activations: { [key: string]: string } = {
      relu: 'ReLU',
      leaky_relu: 'Leaky ReLU',
      elu: 'ELU',
      selu: 'SELU'
    };
    return activations[activation] || activation.toUpperCase();
  }

  openSaveTemplateDialog(): void {
    this.showSaveTemplateDialog = true;
    this.newTemplateName = this.model?.name
      ? `${this.model.name} Template`
      : '';
    this.newTemplateDescription = '';
  }

  closeSaveTemplateDialog(): void {
    this.showSaveTemplateDialog = false;
  }

  saveAsTemplate(data: { name: string; description: string }): void {
    if (!this.model) return;

    this.savingTemplate = true;

    const templateData = {
      name: data.name,
      description: data.description || undefined,
      inputChannels: this.model.inputChannels,
      outputChannels: this.model.outputChannels,
      baseFilters: this.model.baseFilters,
      depth: this.model.depth,
      kernelSize: this.model.kernelSize,
      numConvsPerBlock: this.model.numConvsPerBlock,
      poolingType: this.model.poolingType,
      poolingSize: this.model.poolingSize,
      upsamplingType: this.model.upsamplingType,
      upsamplingSize: this.model.upsamplingSize,
      useBatchNorm: this.model.useBatchNorm,
      activation: this.model.activation,
      dropoutRate: this.model.dropoutRate,
      skipConnections: this.model.skipConnections,
      filterMultiplier: this.model.filterMultiplier,
      epochs: this.model.epochs,
      batchSize: this.model.batchSize,
      learningRate: this.model.learningRate,
      optimizer: this.model.optimizer,
      lossFunction: this.model.lossFunction,
      validationSplit: this.model.validationSplit
    };

    this.modelTemplateService.createTemplate(templateData).subscribe({
      next: (template) => {
        console.log('Template saved:', template);
        this.savingTemplate = false;
        this.closeSaveTemplateDialog();
        alert(`Template "${template.name}" saved successfully!`);
      },
      error: (error) => {
        console.error('Error saving template:', error);
        this.savingTemplate = false;
        alert('Failed to save template');
      }
    });
  }
}
