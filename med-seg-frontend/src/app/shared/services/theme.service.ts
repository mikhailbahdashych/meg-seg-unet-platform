import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'medseg-theme';
  private themeSubject: BehaviorSubject<Theme>;
  public theme$: Observable<Theme>;

  constructor() {
    const savedTheme = this.loadTheme();
    this.themeSubject = new BehaviorSubject<Theme>(savedTheme);
    this.theme$ = this.themeSubject.asObservable();
    this.applyTheme(savedTheme);
  }

  private loadTheme(): Theme {
    // Check localStorage first
    const saved = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (saved) {
      return saved;
    }

    // Check system preference
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }

    return 'light';
  }

  private applyTheme(theme: Theme): void {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);

    // Temporarily add class to enable smooth transitions
    setTimeout(() => {
      root.classList.add('theme-transition');
      setTimeout(() => {
        root.classList.remove('theme-transition');
      }, 300);
    }, 10);
  }

  getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    this.applyTheme(theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
  }

  toggleTheme(): void {
    const newTheme = this.getCurrentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  // Listen to system preference changes
  watchSystemTheme(): void {
    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', (e) => {
          // Only auto-switch if user hasn't manually set a preference
          if (!localStorage.getItem(this.STORAGE_KEY)) {
            this.setTheme(e.matches ? 'dark' : 'light');
          }
        });
    }
  }
}
