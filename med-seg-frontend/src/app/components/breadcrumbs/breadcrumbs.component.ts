import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Router,
  NavigationEnd,
  ActivatedRoute,
  RouterModule
} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter, map } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  url: string;
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  templateUrl: './breadcrumbs.component.html',
  styleUrls: ['./breadcrumbs.component.scss']
})
export class BreadcrumbsComponent implements OnInit {
  breadcrumbs: Breadcrumb[] = [];

  private routeLabels: { [key: string]: string } = {
    upload: 'Upload Dataset',
    train: 'Train Model',
    models: 'My Models',
    inference: 'Run Inference',
    settings: 'Settings'
  };

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {}

  ngOnInit() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map(() => this.buildBreadcrumbs(this.activatedRoute.root))
      )
      .subscribe((breadcrumbs) => {
        this.breadcrumbs = breadcrumbs;
      });

    // Initialize breadcrumbs on load
    this.breadcrumbs = this.buildBreadcrumbs(this.activatedRoute.root);
  }

  private buildBreadcrumbs(
    route: ActivatedRoute,
    url = '',
    breadcrumbs: Breadcrumb[] = []
  ): Breadcrumb[] {
    const children: ActivatedRoute[] = route.children;

    if (children.length === 0) {
      return breadcrumbs;
    }

    for (const child of children) {
      const routeURL: string = child.snapshot.url
        .map((segment) => segment.path)
        .join('/');
      if (routeURL !== '') {
        url += `/${routeURL}`;

        // Get label from mapping or use the URL segment
        const pathSegment = routeURL.split('/')[0];
        const label =
          this.routeLabels[pathSegment] || this.formatLabel(pathSegment);

        breadcrumbs.push({ label, url });
      }
      return this.buildBreadcrumbs(child, url, breadcrumbs);
    }

    return breadcrumbs;
  }

  private formatLabel(segment: string): string {
    // Convert kebab-case to Title Case
    return segment
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
