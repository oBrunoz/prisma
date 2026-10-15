import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Observable, filter, map, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { mensagemDeErro } from '../errors/mensagens';
import { TipoMidia } from '../models/catalogo.models';
import { CONVITES_ASSISTIDO, CONVITES_CURTIDO, sortear } from '../models/convites';
import { Ficha, envioDaFicha, fichaDaAvaliacao } from '../models/ficha';
import { AuthService } from './auth.service';
import { AvaliacaoService } from './avaliacao.service';
import { FichaSyncService } from './ficha-sync.service';
import { ToastService } from './toast.service';
import { WatchlistService } from './watchlist.service';

export type CampoMarca = 'assistido' | 'curtido' | 'watchlist';

export interface Marca {
  assistido: boolean;
  curtido: boolean;
  watchlist: boolean;
}

const MARCA_VAZIA: Marca = { assistido: false, curtido: false, watchlist: false };

// mesma ordem e mesmos rótulos do banner: desmarcado, marcado
export const ACOES_RAPIDAS: { campo: CampoMarca; rotulo: [string, string] }[] = [
  { campo: 'assistido', rotulo: ['Já assisti', 'Assistido'] },
  { campo: 'curtido', rotulo: ['Curtir', 'Curtido'] },
  { campo: 'watchlist', rotulo: ['Watchlist', 'Na watchlist'] },
];

interface MarcaApi {
  tmdbId: number;
  mediaType: 'MOVIE' | 'TV';
  watched: boolean;
  liked: boolean;
  watchlist: boolean;
}

// o mesmo teto da API
const POR_PEDIDO = 60;

const MOTIVOS: Record<CampoMarca, string> = {
  assistido: 'Entre para marcar o que já assistiu',
  curtido: 'Entre para curtir este título',
  watchlist: 'Entre para montar sua watchlist',
};

const ERROS: Record<CampoMarca, [marcar: string, desmarcar: string]> = {
  assistido: ['Não marcamos como assistido', 'Não desmarcamos o assistido'],
  curtido: ['Não salvamos sua curtida', 'Não tiramos sua curtida'],
  watchlist: ['Não atualizamos sua watchlist', 'Não atualizamos sua watchlist'],
};

const chave = (tmdbId: number, tipo: TipoMidia) => `${tipo}-${tmdbId}`;

// o que o usuário marcou em cada card da tela: os cards pedem, o service junta
// num pedido só por fileira e grava os atalhos sem apagar nota e texto da ficha
@Injectable({ providedIn: 'root' })
export class MarcasService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly avaliacoes = inject(AvaliacaoService);
  private readonly watchlist = inject(WatchlistService);
  private readonly sync = inject(FichaSyncService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiUrl}/marks`;

  private readonly marcas = signal<ReadonlyMap<string, Marca>>(new Map());
  private readonly gravando = signal<ReadonlySet<string>>(new Set());

  // pedidas nesta página; trocar de página busca de novo, e o que mudou em outra tela aparece
  private pedidas = new Set<string>();
  private fila = new Set<string>();
  private agendado = false;

  constructor() {
    // entrou ou saiu: as marcas na tela eram de outra pessoa (ou de ninguém)
    effect(() => {
      const logado = this.auth.autenticado();
      untracked(() => {
        this.marcas.set(new Map());
        if (!logado) return;
        this.pedidas.forEach((k) => this.fila.add(k));
        this.agendar();
      });
    });

    this.router.events
      .pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => (this.pedidas = new Set()));

    // o formulário da página do título e o banner gravam por fora
    this.sync
      .todas()
      .pipe(filter((m) => m.origem !== this))
      .subscribe(({ tmdbId, mediaType }) => {
        const k = chave(tmdbId, mediaType);
        if (!this.pedidas.has(k)) return;
        this.fila.add(k);
        this.agendar();
      });
  }

  marca(tmdbId: number, tipo: TipoMidia): Marca | undefined {
    return this.marcas().get(chave(tmdbId, tipo));
  }

  emGravacao(tmdbId: number, tipo: TipoMidia): boolean {
    return this.gravando().has(chave(tmdbId, tipo));
  }

  pedir(tmdbId: number, tipo: TipoMidia): void {
    const k = chave(tmdbId, tipo);
    if (this.pedidas.has(k)) return;
    this.pedidas.add(k);
    if (!this.auth.autenticado()) return;
    this.fila.add(k);
    this.agendar();
  }

  alternar(tmdbId: number, tipo: TipoMidia, campo: CampoMarca): void {
    if (!this.auth.autenticado()) {
      this.auth.pedirLogin(MOTIVOS[campo]);
      return;
    }

    const k = chave(tmdbId, tipo);
    if (this.gravando().has(k)) return;

    const anterior = this.marcas().get(k) ?? MARCA_VAZIA;
    const queria = !anterior[campo];
    this.pedidas.add(k);
    this.gravar(k, { ...anterior, [campo]: queria });
    this.travar(k, true);

    const envio$: Observable<Ficha | null> =
      campo === 'watchlist'
        ? this.salvarWatchlist(tmdbId, tipo, queria)
        : this.salvarFicha(tmdbId, tipo, campo, queria);

    envio$.subscribe({
      next: (ficha) => {
        this.travar(k, false);
        this.sync.avisar(tmdbId, tipo, this);
        // só convida quem ainda não deu nota nem escreveu
        if (ficha && queria && ficha.nota === null && ficha.texto === '') {
          this.convidar(tmdbId, tipo, campo === 'assistido' ? CONVITES_ASSISTIDO : CONVITES_CURTIDO);
        }
      },
      error: (falha) => {
        this.gravar(k, anterior);
        this.travar(k, false);
        this.toast.erro(ERROS[campo][queria ? 0 : 1], {
          detalhe: mensagemDeErro(falha),
          chave: `atalho-${tmdbId}`,
        });
      },
    });
  }

  private salvarWatchlist(tmdbId: number, tipo: TipoMidia, queria: boolean): Observable<null> {
    const envio$: Observable<unknown> = queria
      ? this.watchlist.adicionar(tmdbId, tipo)
      : this.watchlist.remover(tmdbId, tipo);
    return envio$.pipe(map(() => null));
  }

  // o backend substitui a ficha inteira: lê a atual para não perder nota e texto
  private salvarFicha(
    tmdbId: number,
    tipo: TipoMidia,
    campo: 'assistido' | 'curtido',
    queria: boolean,
  ): Observable<Ficha> {
    return this.avaliacoes.minhaNoTitulo(tmdbId, tipo).pipe(
      map((minha) => {
        const atual = fichaDaAvaliacao(minha);
        // nota sem ter assistido não faz sentido, igual ao formulário
        return campo === 'assistido'
          ? { ...atual, assistido: queria, nota: queria ? atual.nota : null }
          : { ...atual, curtido: queria };
      }),
      switchMap((nova) =>
        this.avaliacoes.salvar(envioDaFicha(tmdbId, tipo, nova)).pipe(map(() => nova)),
      ),
    );
  }

  private convidar(tmdbId: number, tipo: TipoMidia, convites: string[]): void {
    const rota = ['/search', tipo === 'movie' ? 'movies' : 'series', String(tmdbId)];
    this.toast.info(sortear(convites), {
      chave: `convite-${tmdbId}`,
      acao: {
        rotulo: 'Avaliar agora',
        executar: () => this.router.navigate(rota, { fragment: 'sua-avaliacao' }),
      },
    });
  }

  // os cards de uma fileira nascem juntos; um instante de espera junta todos num pedido
  private agendar(): void {
    if (this.agendado) return;
    this.agendado = true;
    setTimeout(() => {
      this.agendado = false;
      this.despachar();
    }, 50);
  }

  private despachar(): void {
    const chaves = [...this.fila];
    this.fila.clear();
    if (!this.auth.autenticado()) return;

    for (let i = 0; i < chaves.length; i += POR_PEDIDO) {
      const lote = chaves.slice(i, i + POR_PEDIDO);
      this.http
        .get<MarcaApi[]>(this.base, { params: { titles: lote.join(',') } })
        .subscribe({
          next: (lista) => {
            const vindas = new Map(
              lista.map((m) => [
                chave(m.tmdbId, m.mediaType === 'MOVIE' ? 'movie' : 'tv'),
                { assistido: m.watched, curtido: m.liked, watchlist: m.watchlist },
              ]),
            );
            this.marcas.update((atual) => {
              const nova = new Map(atual);
              for (const k of lote) {
                // o que está gravando agora vale mais que a leitura que saiu antes
                if (this.gravando().has(k)) continue;
                const m = vindas.get(k);
                if (m) nova.set(k, m);
                else nova.delete(k);
              }
              return nova;
            });
          },
          // o selo é um extra: sem ele o card continua inteiro
          error: () => {},
        });
    }
  }

  private gravar(k: string, marca: Marca): void {
    this.marcas.update((atual) => new Map(atual).set(k, marca));
  }

  private travar(k: string, sim: boolean): void {
    this.gravando.update((atual) => {
      const novo = new Set(atual);
      if (sim) novo.add(k);
      else novo.delete(k);
      return novo;
    });
  }
}
