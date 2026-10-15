import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Maratona, NesteDia } from '../models/vitrine.models';

// seções da home que a API monta de uma vez e guarda
@Injectable({ providedIn: 'root' })
export class VitrineService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/vitrine`;

  nesteDia(): Observable<NesteDia> {
    return this.http.get<NesteDia>(`${this.base}/neste-dia`);
  }

  maratonas(): Observable<Maratona[]> {
    return this.http.get<Maratona[]>(`${this.base}/maratonas`);
  }
}
