import { Injectable, signal } from '@angular/core';

// a fita de listras atrás do site; página com fundo próprio (perfil enfeitado) desliga enquanto aberta
@Injectable({ providedIn: 'root' })
export class FundoService {
  readonly listras = signal(true);
}
