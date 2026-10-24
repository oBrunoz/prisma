import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export const SITE_URL = 'https://prismadot.com.br';
export const TITULO_HOME = 'Prisma · Seu diário de filmes e séries';
export const DESCRICAO_PADRAO =
  'Guarde o que você assiste: marque os filmes e séries que viu, dê nota, escreva resenhas e monte sua watchlist. Veja onde assistir e jogue os desafios do dia. De graça e sem anúncios.';
const IMAGEM_PADRAO = `${SITE_URL}/brand/og-image.png`;

export interface DadosSeo {
  // sem título é a home; com título vira "Título · Prisma"
  titulo?: string;
  descricao?: string;
  imagem?: string | null;
  tipo?: 'website' | 'video.movie' | 'video.tv_show' | 'profile';
  indexar?: boolean;
  dados?: object | null;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  definir(seo: DadosSeo): void {
    const titulo = seo.titulo ? `${seo.titulo} · Prisma` : TITULO_HOME;
    const descricao = resumir(seo.descricao || DESCRICAO_PADRAO);
    const imagem = seo.imagem || IMAGEM_PADRAO;
    // query e fragmento não mudam a página: recortes do catálogo apontam para a base
    const url = SITE_URL + (this.doc.location.pathname.replace(/\/+$/, '') || '/');

    this.title.setTitle(titulo);
    this.meta.updateTag({ name: 'description', content: descricao });
    this.meta.updateTag({ name: 'robots', content: seo.indexar === false ? 'noindex, follow' : 'index, follow' });
    this.meta.updateTag({ property: 'og:title', content: titulo });
    this.meta.updateTag({ property: 'og:description', content: descricao });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: seo.tipo ?? 'website' });
    this.meta.updateTag({ property: 'og:image', content: imagem });
    this.meta.updateTag({ name: 'twitter:title', content: titulo });
    this.meta.updateTag({ name: 'twitter:description', content: descricao });
    this.meta.updateTag({ name: 'twitter:image', content: imagem });
    // a imagem padrão tem 1200×630; as da TMDB variam e é melhor não declarar
    if (imagem === IMAGEM_PADRAO) {
      this.meta.updateTag({ property: 'og:image:width', content: '1200' });
      this.meta.updateTag({ property: 'og:image:height', content: '630' });
    } else {
      this.meta.removeTag('property="og:image:width"');
      this.meta.removeTag('property="og:image:height"');
    }

    this.canonical(url);
    this.jsonLd(seo.dados ?? null);
  }

  private canonical(url: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'canonical';
      this.doc.head.appendChild(link);
    }
    link.href = url;
  }

  // o JSON-LD do site fica fixo no index.html; este é só o da página
  private jsonLd(dados: object | null): void {
    const atual = this.doc.getElementById('seo-pagina');
    if (!dados) {
      atual?.remove();
      return;
    }
    const script = atual ?? this.doc.createElement('script');
    script.id = 'seo-pagina';
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...dados });
    if (!atual) this.doc.head.appendChild(script);
  }
}

// o Google corta por volta de 160 caracteres; corta na palavra
function resumir(texto: string, limite = 160): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= limite) return limpo;
  return limpo.slice(0, limite - 1).replace(/\s+\S*$/, '') + '…';
}
