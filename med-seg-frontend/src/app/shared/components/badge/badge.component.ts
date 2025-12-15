import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.scss']
})
export class BadgeComponent {
  @Input() variant: BadgeVariant = 'neutral';
  @Input() icon?: string;
  @Input() dot = false; // Show colored dot instead of/with icon
}
