import {
  Component,
  Input,
  OnChanges,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface UNetLayer {
  depth: number;
  channels: number;
  spatialSize: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-unet-visualizer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './unet-visualizer.component.html',
  styleUrls: ['./unet-visualizer.component.scss']
})
export class UnetVisualizerComponent implements OnChanges, AfterViewInit {
  @Input() inputChannels: number = 1;
  @Input() outputChannels: number = 1;
  @Input() baseFilters: number = 64;
  @Input() depth: number = 4;
  @Input() filterMultiplier: number = 2;
  @Input() inputSize: number = 256;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  private encoderLayers: UNetLayer[] = [];
  private decoderLayers: UNetLayer[] = [];

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.drawArchitecture();
  }

  ngOnChanges(): void {
    if (this.canvas && this.ctx) {
      this.drawArchitecture();
    }
  }

  private calculateLayers(): void {
    this.encoderLayers = [];
    this.decoderLayers = [];

    // Calculate encoder layers
    let currentChannels = this.baseFilters;
    let currentSize = this.inputSize;

    for (let i = 0; i < this.depth; i++) {
      this.encoderLayers.push({
        depth: i,
        channels: currentChannels,
        spatialSize: currentSize,
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });

      currentChannels *= this.filterMultiplier;
      currentSize = Math.floor(currentSize / 2);
    }

    // Bottleneck
    this.encoderLayers.push({
      depth: this.depth,
      channels: currentChannels,
      spatialSize: currentSize,
      x: 0,
      y: 0,
      width: 0,
      height: 0
    });

    // Calculate decoder layers (mirror of encoder, but build in reverse order)
    // Start from bottleneck and work back up
    const decoderLayersTemp = [];
    for (let i = this.depth - 1; i >= 0; i--) {
      currentChannels = Math.floor(currentChannels / this.filterMultiplier);
      currentSize *= 2;

      decoderLayersTemp.push({
        depth: i,
        channels: currentChannels,
        spatialSize: currentSize,
        x: 0,
        y: 0,
        width: 0,
        height: 0
      });
    }
    // Reverse so decoder[0] has the smallest spatial size (bottom of U)
    this.decoderLayers = decoderLayersTemp.reverse();
  }

  private drawArchitecture(): void {
    this.calculateLayers();

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    // Clear canvas
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Layout parameters
    const padding = 40;
    const blockSpacing = 60;
    const maxBlockHeight = 120;
    const maxBlockWidth = 80;
    const minBlockHeight = 30;
    const minBlockWidth = 40;

    // Position encoder layers (left side, top to bottom)
    let currentY = padding;
    this.encoderLayers.forEach((layer) => {
      // Block size decreases with depth (spatial dimension decreases)
      const sizeRatio = layer.spatialSize / this.inputSize;
      const blockHeight = Math.max(
        minBlockHeight,
        maxBlockHeight * Math.sqrt(sizeRatio)
      );
      const blockWidth = Math.max(minBlockWidth, maxBlockWidth * sizeRatio);

      layer.x = padding;
      layer.y = currentY;
      layer.width = blockWidth;
      layer.height = blockHeight;

      currentY += blockHeight + blockSpacing;
    });

    // Position decoder layers (right side, bottom to top to form U shape)
    // Start from the last encoder Y position (bottom) and work upward
    const lastEncoderY = this.encoderLayers[this.encoderLayers.length - 1].y;
    currentY = lastEncoderY;

    // Decoder layers are already in the right order (smallest at [0], largest at [end])
    [...this.decoderLayers].reverse().forEach((layer) => {
      const sizeRatio = layer.spatialSize / this.inputSize;
      const blockHeight = Math.max(
        minBlockHeight,
        maxBlockHeight * Math.sqrt(sizeRatio)
      );
      const blockWidth = Math.max(minBlockWidth, maxBlockWidth * sizeRatio);

      layer.x = canvasWidth - padding - blockWidth;
      layer.y = currentY;
      layer.width = blockWidth;
      layer.height = blockHeight;

      // Move upward for the next block
      currentY -= blockHeight + blockSpacing;
    });

    // Draw skip connections first (behind blocks)
    this.drawSkipConnections();

    // Draw encoder blocks
    this.encoderLayers.forEach((layer) => {
      const color = this.getColorForDepth(layer.depth);
      this.drawBlock(layer, color);
    });

    // Draw decoder blocks
    this.decoderLayers.forEach((layer) => {
      const color = this.getColorForDepth(layer.depth);
      this.drawBlock(layer, color);
    });

    // Draw input arrow
    this.drawInputOutput();
  }

  private drawBlock(layer: UNetLayer, color: string): void {
    const { x, y, width, height, channels, spatialSize } = layer;

    // Draw 3D effect with multiple rectangles
    const depth3D = 8;
    for (let i = 0; i < depth3D; i++) {
      this.ctx.fillStyle = this.adjustBrightness(color, -i * 5);
      this.ctx.fillRect(x + i, y - i, width, height);
    }

    // Draw main block
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, width, height);

    // Draw labels
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 11px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Channel count
    this.ctx.fillText(`${channels}`, x + width / 2, y + height / 2 - 8);

    // Spatial size
    this.ctx.font = '9px Arial';
    this.ctx.fillText(
      `${spatialSize}×${spatialSize}`,
      x + width / 2,
      y + height / 2 + 6
    );
  }

  private drawSkipConnections(): void {
    // Draw connections from encoder to corresponding decoder layers
    // Since decoder is now positioned in reverse (bottom to top), connect matching depths
    for (let i = 0; i < this.decoderLayers.length; i++) {
      const encoderLayer = this.encoderLayers[i];
      // Find decoder layer with matching depth
      const decoderLayer = this.decoderLayers.find(
        (d) => d.depth === encoderLayer.depth
      );

      if (!decoderLayer) continue;

      this.ctx.strokeStyle = 'rgba(100, 100, 255, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);

      this.ctx.beginPath();
      this.ctx.moveTo(
        encoderLayer.x + encoderLayer.width,
        encoderLayer.y + encoderLayer.height / 2
      );
      this.ctx.lineTo(decoderLayer.x, decoderLayer.y + decoderLayer.height / 2);
      this.ctx.stroke();

      this.ctx.setLineDash([]);
    }
  }

  private drawInputOutput(): void {
    const firstEncoder = this.encoderLayers[0];
    // Last decoder is now at index 0 since we reversed the positioning
    const lastDecoder =
      this.decoderLayers.find((d) => d.depth === 0) || this.decoderLayers[0];

    // Input arrow
    this.drawArrow(
      firstEncoder.x - 25,
      firstEncoder.y + firstEncoder.height / 2,
      firstEncoder.x - 5,
      firstEncoder.y + firstEncoder.height / 2,
      '#4a90e2'
    );

    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 11px Arial';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(
      `Input: ${this.inputChannels}ch`,
      firstEncoder.x - 30,
      firstEncoder.y + firstEncoder.height / 2
    );

    // Output arrow
    this.drawArrow(
      lastDecoder.x + lastDecoder.width + 5,
      lastDecoder.y + lastDecoder.height / 2,
      lastDecoder.x + lastDecoder.width + 25,
      lastDecoder.y + lastDecoder.height / 2,
      '#4a90e2'
    );

    this.ctx.fillStyle = '#333';
    this.ctx.font = 'bold 11px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(
      `Output: ${this.outputChannels}ch`,
      lastDecoder.x + lastDecoder.width + 30,
      lastDecoder.y + lastDecoder.height / 2
    );
  }

  private drawArrow(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string
  ): void {
    const headLength = 8;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = 2;

    // Draw line
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();

    // Draw arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.ctx.closePath();
    this.ctx.fill();
  }

  private getColorForDepth(depth: number): string {
    const colors = [
      '#3f51b5', // Deep blue
      '#5c6bc0',
      '#7986cb',
      '#9fa8da',
      '#c5cae9'
    ];

    const index = Math.min(depth, colors.length - 1);
    return colors[index];
  }

  private adjustBrightness(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }
}
