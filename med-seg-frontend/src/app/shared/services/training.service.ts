import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
}
