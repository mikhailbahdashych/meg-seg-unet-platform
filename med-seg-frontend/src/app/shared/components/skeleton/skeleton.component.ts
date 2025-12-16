import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SkeletonType = 'text' | 'circle' | 'rect' | 'card';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
  styleUrls: ['./skeleton.component.scss']
})
export class SkeletonComponent {
  @Input() type: SkeletonType = 'rect';
  @Input() width = '100%';
  @Input() height = '20px';
  @Input() count = 1;

  get items(): number[] {
    return Array(this.count).fill(0);
  }
}
