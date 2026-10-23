import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SeoService } from './services/seo.service';

// cada navegação volta ao SEO da rota (title + data.descricao/indexar); a estratégia padrão
// deixaria o da página anterior. Páginas com dado da TMDB completam depois com o SeoService
@Injectable({ providedIn: 'root' })
export class TituloStrategy extends TitleStrategy {
  private readonly seo = inject(SeoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let rota: ActivatedRouteSnapshot | null = snapshot.root;
    let descricao: string | undefined;
    let indexar = true;
    while (rota) {
      descricao = rota.data['descricao'] ?? descricao;
      if (rota.data['indexar'] === false) indexar = false;
      rota = rota.firstChild;
    }
    this.seo.definir({ titulo: this.buildTitle(snapshot), descricao, indexar });
  }
}
