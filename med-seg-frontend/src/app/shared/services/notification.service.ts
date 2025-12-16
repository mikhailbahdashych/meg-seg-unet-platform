import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private defaultConfig: MatSnackBarConfig = {
    duration: 4000,
    horizontalPosition: 'right',
    verticalPosition: 'top',
    panelClass: ['custom-snackbar']
  };

  constructor(private snackBar: MatSnackBar) {}

  success(message: string, action: string = 'Close') {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: ['custom-snackbar', 'snackbar-success']
    });
  }

  error(message: string, action: string = 'Close') {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      duration: 6000, // Errors stay longer
      panelClass: ['custom-snackbar', 'snackbar-error']
    });
  }

  info(message: string, action: string = 'Close') {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: ['custom-snackbar', 'snackbar-info']
    });
  }

  warning(message: string, action: string = 'Close') {
    this.snackBar.open(message, action, {
      ...this.defaultConfig,
      panelClass: ['custom-snackbar', 'snackbar-warning']
    });
  }

  // Custom notification with full config control
  custom(message: string, config?: MatSnackBarConfig) {
    this.snackBar.open(message, 'Close', {
      ...this.defaultConfig,
      ...config
    });
  }
}
