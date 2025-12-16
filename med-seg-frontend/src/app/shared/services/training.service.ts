import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Template } from '@interfaces/template.interface';

export interface GpuType {
  id: string;
  displayName: string;
  manufacturer: string;
  memoryInGb: number;
  secureCloud: boolean;
  communityCloud: boolean;
  uninterruptablePrice: number;
  minimumBidPrice: number;
  stockStatus: string;
  recommended?: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrainingService {
  private apiUrl = `${environment.apiUrl}/training`;

  constructor(private http: HttpClient) {}

  getAvailableGpuTypes(): Observable<GpuType[]> {
    return this.http.get<GpuType[]>(`${this.apiUrl}/gpu-types`);
  }

  getTemplates(
    includeRunpodTemplates: boolean = true,
    includePublicTemplates: boolean = false,
    includeEndpointBoundTemplates: boolean = false
  ): Observable<Template[]> {
    const params: any = {};
    if (includeRunpodTemplates) params.includeRunpodTemplates = 'true';
    if (includePublicTemplates) params.includePublicTemplates = 'true';
    if (includeEndpointBoundTemplates)
      params.includeEndpointBoundTemplates = 'true';

    return this.http.get<Template[]>(`${this.apiUrl}/templates`, { params });
  }
}
