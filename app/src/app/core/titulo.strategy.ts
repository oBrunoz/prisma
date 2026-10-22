import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

// rota sem title volta para "Prisma"; a estratégia padrão deixaria o da página anterior
@Injectable({ providedIn: 'root' })
export class TituloStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const titulo = this.buildTitle(snapshot);
    this.title.setTitle(titulo ? `${titulo} · Prisma` : 'Prisma');
  }
}
