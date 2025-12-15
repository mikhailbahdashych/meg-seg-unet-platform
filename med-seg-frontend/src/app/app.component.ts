import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'med-seg-frontend';

  constructor(private themeService: ThemeService) {}

  ngOnInit() {
    // Watch for system theme changes
    this.themeService.watchSystemTheme();
  }
}
