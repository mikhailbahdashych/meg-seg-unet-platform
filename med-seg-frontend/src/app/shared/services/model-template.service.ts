import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ModelTemplate } from '@interfaces/model-template.interface';
import { environment } from '@environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ModelTemplateService {
  private readonly apiUrl = `${environment.apiUrl}/model-templates`;

  constructor(private http: HttpClient) {}

  getAllTemplates(): Observable<ModelTemplate[]> {
    return this.http.get<ModelTemplate[]>(this.apiUrl);
  }

  getTemplate(id: number): Observable<ModelTemplate> {
    return this.http.get<ModelTemplate>(`${this.apiUrl}/${id}`);
  }

  createTemplate(
    template: Omit<ModelTemplate, 'id' | 'createdAt'>
  ): Observable<ModelTemplate> {
    return this.http.post<ModelTemplate>(this.apiUrl, template);
  }

  updateTemplate(
    id: number,
    updates: Partial<ModelTemplate>
  ): Observable<ModelTemplate> {
    return this.http.put<ModelTemplate>(`${this.apiUrl}/${id}`, updates);
  }

  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
