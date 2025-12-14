import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Model } from '@interfaces/model.interface';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ModelService {
  private readonly apiUrl = `${environment.apiUrl}/models`;

  constructor(private http: HttpClient) {}

  getAllModels(): Observable<Model[]> {
    return this.http.get<Model[]>(this.apiUrl);
  }

  getModel(id: number): Observable<Model> {
    return this.http.get<Model>(`${this.apiUrl}/${id}`);
  }

  getModelsByDataset(datasetId: number): Observable<Model[]> {
    return this.http.get<Model[]>(`${this.apiUrl}/dataset/${datasetId}`);
  }

  trainModel(trainingConfig: any): Observable<Model> {
    return this.http.post<Model>(`${this.apiUrl}/train`, trainingConfig);
  }

  getTrainingStatus(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}/status`);
  }

  getDownloadUrl(id: number): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/${id}/download`);
  }

  cancelTraining(id: number): Observable<Model> {
    return this.http.post<Model>(`${this.apiUrl}/${id}/cancel`, {});
  }

  updateModel(id: number, updates: Partial<Model>): Observable<Model> {
    return this.http.put<Model>(`${this.apiUrl}/${id}`, updates);
  }

  deleteModel(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  bulkDeleteModels(
    ids: number[]
  ): Observable<{ deleted: number; failed: number[] }> {
    return this.http.post<{ deleted: number; failed: number[] }>(
      `${this.apiUrl}/bulk-delete`,
      { ids }
    );
  }
}
