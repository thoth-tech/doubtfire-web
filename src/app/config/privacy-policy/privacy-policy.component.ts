import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import API_URL from 'src/app/config/constants/apiURL';

interface PrivacyResponse {
  privacy: string;
  plagiarism: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrivacyPolicy {
  privacy = '';
  plagiarism = '';
  loaded = false;

  constructor(private http: HttpClient) {
    const url = `${API_URL}/settings/privacy`;

    this.http.get<PrivacyResponse>(url).subscribe(response => {
      this.privacy = response.privacy;
      this.plagiarism = response.plagiarism;
      this.loaded = true;
    });
  }
}
