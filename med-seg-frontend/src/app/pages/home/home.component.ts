import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent } from '@shared/components/button/button.component';
import { CardComponent } from '@shared/components/card/card.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';

interface QuickAction {
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
}

interface StatCard {
  label: string;
  value: string;
  icon: string;
  trend?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    ButtonComponent,
    CardComponent,
    BadgeComponent
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  stats: StatCard[] = [
    { label: 'Total Datasets', value: '0', icon: 'folder_open', trend: '+0%' },
    {
      label: 'Trained Models',
      value: '0',
      icon: 'model_training',
      trend: '+0%'
    },
    { label: 'Inference Runs', value: '0', icon: 'biotech', trend: '+0%' },
    { label: 'Success Rate', value: '0%', icon: 'check_circle', trend: '+0%' }
  ];

  quickActions: QuickAction[] = [
    {
      title: 'Upload Dataset',
      description:
        'Upload medical image datasets with masks for U-Net training',
      icon: 'cloud_upload',
      route: '/upload',
      color: '#4F46E5'
    },
    {
      title: 'Train Model',
      description: 'Configure hyperparameters and train new U-Net models',
      icon: 'model_training',
      route: '/train',
      color: '#7C3AED'
    },
    {
      title: 'My Models',
      description: 'View training history and manage your trained models',
      icon: 'dashboard',
      route: '/models',
      color: '#2563EB'
    },
    {
      title: 'Run Inference',
      description: 'Perform automated segmentation on new medical images',
      icon: 'biotech',
      route: '/inference',
      color: '#059669'
    }
  ];

  ngOnInit() {
    // TODO: Load actual stats from backend
  }
}
