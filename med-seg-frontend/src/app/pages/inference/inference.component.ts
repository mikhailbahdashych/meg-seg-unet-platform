import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelService } from '@services/model.service';
import {
  InferenceService,
  InferenceResult,
  BatchInferenceResult
} from '@services/inference.service';
import { Model } from '@interfaces/model.interface';

@Component({
  selector: 'app-inference',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inference.component.html',
  styleUrls: ['./inference.component.scss']
})
export class InferenceComponent implements OnInit {
  // Model selection
  models: Model[] = [];
  selectedModelId: number | null = null;

  // Mode selection
  inferenceMode: 'single' | 'batch' = 'single';

  // File upload
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  // Inference state
  isRunning = false;
  inferenceResult: InferenceResult | null = null;
  batchResult: BatchInferenceResult | null = null;
  errorMessage = '';

  // View mode
  viewMode: 'side-by-side' | 'overlay' | 'heatmap' = 'side-by-side';
  maskOpacity = 50;
  selectedResultIndex = 0;

  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private modelService: ModelService,
    private inferenceService: InferenceService
  ) {}

  ngOnInit(): void {
    this.loadCompletedModels();
  }

  loadCompletedModels(): void {
    this.modelService.getAllModels().subscribe({
      next: (models) => {
        this.models = models.filter((m) => m.status === 'completed');
      },
      error: (error) => {
        console.error('Error loading models:', error);
        this.errorMessage = 'Failed to load models';
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];

      if (this.inferenceMode === 'single') {
        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          this.errorMessage = 'File size must be less than 10MB';
          return;
        }

        // Validate file type
        const allowedTypes = [
          'image/png',
          'image/jpeg',
          'image/jpg',
          'image/bmp',
          'image/tiff'
        ];
        if (!allowedTypes.includes(file.type)) {
          this.errorMessage =
            'Invalid file type. Only PNG, JPG, JPEG, BMP, and TIFF are allowed.';
          return;
        }

        this.selectedFile = file;
        this.errorMessage = '';

        // Generate preview
        const reader = new FileReader();
        reader.onload = (e) => {
          this.imagePreview = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        // Batch mode - validate ZIP file
        if (file.size > 100 * 1024 * 1024) {
          this.errorMessage = 'ZIP file size must be less than 100MB';
          return;
        }

        if (!file.name.toLowerCase().endsWith('.zip')) {
          this.errorMessage = 'Invalid file type. Only ZIP files are allowed.';
          return;
        }

        this.selectedFile = file;
        this.errorMessage = '';
        this.imagePreview = null;
      }
    }
  }

  onModeChange(): void {
    // Reset selection when switching modes
    this.selectedFile = null;
    this.imagePreview = null;
    this.inferenceResult = null;
    this.batchResult = null;
    this.errorMessage = '';
  }

  canRunInference(): boolean {
    return (
      this.selectedModelId !== null &&
      this.selectedFile !== null &&
      !this.isRunning
    );
  }

  runInference(): void {
    if (!this.canRunInference()) return;

    this.isRunning = true;
    this.inferenceResult = null;
    this.batchResult = null;
    this.errorMessage = '';

    if (this.inferenceMode === 'single') {
      this.inferenceService
        .runInference(this.selectedModelId!, this.selectedFile!)
        .subscribe({
          next: (result) => {
            this.inferenceResult = result;
            this.isRunning = false;

            // Auto-render overlay if in overlay mode
            if (this.viewMode === 'overlay') {
              setTimeout(() => this.renderOverlay(), 100);
            }
          },
          error: (error) => {
            console.error('Inference failed:', error);
            this.isRunning = false;
            this.errorMessage =
              error.error?.message || 'Inference failed. Please try again.';
          }
        });
    } else {
      this.inferenceService
        .runBatchInference(this.selectedModelId!, this.selectedFile!)
        .subscribe({
          next: (result) => {
            this.batchResult = result;
            this.isRunning = false;
            this.selectedResultIndex = 0;

            if (result.results.length > 0) {
              this.inferenceResult = result.results[0];
              // Auto-render overlay if in overlay mode
              if (this.viewMode === 'overlay') {
                setTimeout(() => this.renderOverlay(), 100);
              }
            }
          },
          error: (error) => {
            console.error('Batch inference failed:', error);
            this.isRunning = false;
            this.errorMessage =
              error.error?.message ||
              'Batch inference failed. Please try again.';
          }
        });
    }
  }

  selectBatchResult(index: number): void {
    if (this.batchResult && this.batchResult.results[index]) {
      this.selectedResultIndex = index;
      this.inferenceResult = this.batchResult.results[index];

      // Auto-render overlay if in overlay mode
      if (this.viewMode === 'overlay') {
        setTimeout(() => this.renderOverlay(), 100);
      }
    }
  }

  switchView(mode: 'side-by-side' | 'overlay' | 'heatmap'): void {
    this.viewMode = mode;

    if (mode === 'overlay' && this.inferenceResult) {
      setTimeout(() => this.renderOverlay(), 100);
    }
  }

  renderOverlay(): void {
    if (!this.overlayCanvas || !this.inferenceResult) return;

    const canvas = this.overlayCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load both images
    const original = new Image();
    const mask = new Image();

    original.onload = () => {
      canvas.width = original.width;
      canvas.height = original.height;

      // Draw original
      ctx.drawImage(original, 0, 0);

      mask.onload = () => {
        // Draw mask with transparency
        ctx.globalAlpha = this.maskOpacity / 100;
        ctx.drawImage(mask, 0, 0);
        ctx.globalAlpha = 1.0;
      };

      mask.src = this.inferenceResult!.maskImage;
    };

    original.src = this.inferenceResult.originalImage;
  }

  getSelectedModel(): Model | null {
    if (!this.selectedModelId) return null;
    return this.models.find((m) => m.id === this.selectedModelId) || null;
  }
}
