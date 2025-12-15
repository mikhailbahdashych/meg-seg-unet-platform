import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Theme } from '../../shared/services/theme.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent {
  @Input() currentTheme: Theme = 'light';
  @Output() themeToggle = new EventEmitter<void>();
  @Output() sidebarToggle = new EventEmitter<void>();

  notificationCount = 0; // Placeholder for future notifications

  onThemeToggle() {
    this.themeToggle.emit();
  }

  onSidebarToggle() {
    this.sidebarToggle.emit();
  }
}
