import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '@components/sidebar/sidebar.component';
import { TopbarComponent } from '@components/topbar/topbar.component';
import { BreadcrumbsComponent } from '@components/breadcrumbs/breadcrumbs.component';
import { ThemeService, Theme } from '../../shared/services/theme.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    BreadcrumbsComponent
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss']
})
export class LayoutComponent implements OnInit {
  sidebarCollapsed = false;
  currentTheme: Theme = 'light';

  constructor(private themeService: ThemeService) {}

  ngOnInit() {
    this.currentTheme = this.themeService.getCurrentTheme();
    this.themeService.theme$.subscribe((theme) => {
      this.currentTheme = theme;
    });
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
