import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CredentialsStatusDto,
  UpdateAwsCredentialsDto,
  UpdateRunpodCredentialsDto
} from '@interfaces/credentials.interface';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = `${environment.apiUrl}/settings`;

  constructor(private http: HttpClient) {}

  getCredentialsStatus(): Observable<CredentialsStatusDto> {
    return this.http.get<CredentialsStatusDto>(
      `${this.apiUrl}/credentials/status`
    );
  }

  updateAwsCredentials(
    credentials: UpdateAwsCredentialsDto
  ): Observable<{ success: boolean; error?: string }> {
    return this.http.put<{ success: boolean; error?: string }>(
      `${this.apiUrl}/credentials/aws`,
      credentials
    );
  }

  updateRunpodCredentials(
    credentials: UpdateRunpodCredentialsDto
  ): Observable<{ success: boolean; error?: string }> {
    return this.http.put<{ success: boolean; error?: string }>(
      `${this.apiUrl}/credentials/runpod`,
      credentials
    );
  }

  validateAwsCredentials(): Observable<{ valid: boolean; error?: string }> {
    return this.http.post<{ valid: boolean; error?: string }>(
      `${this.apiUrl}/credentials/aws/validate`,
      {}
    );
  }

  validateRunpodCredentials(): Observable<{ valid: boolean; error?: string }> {
    return this.http.post<{ valid: boolean; error?: string }>(
      `${this.apiUrl}/credentials/runpod/validate`,
      {}
    );
  }
}
