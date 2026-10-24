import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import {
  AvaliacaoUsuario,
  EnvioAvaliacao,
  ItemWatchlist,
} from '../../../core/models/catalogo.models';
import { WatchlistService } from '../../../core/services/watchlist.service';
import { FichaSyncService } from '../../../core/services/ficha-sync.service';
import { ToastService } from '../../../core/services/toast.service';
import { MediaActionsComponent } from './media-actions.component';

const AVALIACAO: AvaliacaoUsuario = {
  id: 'r1',
  rating: null,
  content: null,
  liked: false,
  watchedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('MediaActionsComponent', () => {
  let fixture: ComponentFixture<MediaActionsComponent>;
  let componente: MediaActionsComponent;

  let contem$: Subject<{ present: boolean }>;
  let cargasDeAvaliacao: Subject<AvaliacaoUsuario | null>[];
  let adicionar$: Subject<ItemWatchlist>;

  let watchlist: jasmine.SpyObj<WatchlistService>;
  let avaliacoes: jasmine.SpyObj<AvaliacaoService>;

  beforeEach(async () => {
    contem$ = new Subject();
    adicionar$ = new Subject();
    cargasDeAvaliacao = [];

    watchlist = jasmine.createSpyObj<WatchlistService>('WatchlistService', [
      'contem',
      'adicionar',
      'remover',
    ]);
    watchlist.contem.and.returnValue(contem$);
    watchlist.adicionar.and.returnValue(adicionar$);

    avaliacoes = jasmine.createSpyObj<AvaliacaoService>('AvaliacaoService', [
      'minhaNoTitulo',
      'estatisticas',
      'salvar',
      'remover',
    ]);
    // uma carga por título, para poder responder a antiga depois da troca
    avaliacoes.minhaNoTitulo.and.callFake(() => {
      const carga = new Subject<AvaliacaoUsuario | null>();
      cargasDeAvaliacao.push(carga);
      return carga;
    });
    avaliacoes.salvar.and.returnValue(of(AVALIACAO));

    await TestBed.configureTestingModule({
      imports: [MediaActionsComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: WatchlistService, useValue: watchlist },
        { provide: AvaliacaoService, useValue: avaliacoes },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MediaActionsComponent);
    componente = fixture.componentInstance;
    TestBed.inject(AuthService).usuario.set({
      id: 'u1',
      username: 'teste',
      name: 'Teste',
      avatarUrl: null,
      bio: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  function abrirTitulo(tmdbId: number): void {
    fixture.componentRef.setInput('tmdbId', tmdbId);
    fixture.componentRef.setInput('mediaType', 'movie');
    fixture.detectChanges();
  }

  function ultimoEnvio(): EnvioAvaliacao {
    return avaliacoes.salvar.calls.mostRecent().args[0];
  }

  describe('watchlist', () => {
    it('não deixa o botão preso quando o item já não está na watchlist', () => {
      abrirTitulo(1);
      contem$.next({ present: true });
      expect(componente.naWatchlist()).toBeTrue();

      watchlist.remover.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      componente.alternarWatchlist();

      expect(componente.naWatchlist()).toBeFalse();
      expect(TestBed.inject(ToastService).itens()).toEqual([]);
      expect(componente.salvandoWatchlist()).toBeFalse();
    });

    it('descarta a resposta da watchlist quando o título já mudou', () => {
      abrirTitulo(1);
      contem$.next({ present: false });

      componente.alternarWatchlist();
      abrirTitulo(2);

      // resposta do título 1 chegando depois da troca
      adicionar$.next({} as ItemWatchlist);

      expect(componente.naWatchlist()).toBeFalse();
    });
  });

  describe('nota', () => {
    it('mapeia meia estrela para nota ímpar e estrela cheia para par', () => {
      abrirTitulo(1);

      componente.nota.set(7);
      expect(componente.preenchimento(3)).toBe('cheia');
      expect(componente.preenchimento(4)).toBe('meia');
      expect(componente.preenchimento(5)).toBe('vazia');

      componente.nota.set(10);
      expect(componente.preenchimento(5)).toBe('cheia');
    });

    it('desenha a meia estrela com metade da largura', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next({ ...AVALIACAO, rating: 7 });
      fixture.detectChanges();

      const raiz = fixture.nativeElement as HTMLElement;
      const larguras = Array.from(
        raiz.querySelectorAll<HTMLElement>('.text-yellow-400.absolute'),
      ).map((el) => el.style.width);

      // nota 7 = três estrelas cheias e uma pela metade; a quinta nem é desenhada
      expect(larguras).toEqual(['100%', '100%', '100%', '50%']);
    });

    it('marca como assistido ao dar nota sem gravar ainda', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next(null);

      componente.definirNota(8);

      expect(componente.assistido()).toBeTrue();
      expect(componente.alterada()).toBeTrue();
      expect(avaliacoes.salvar).not.toHaveBeenCalled();
    });

    it('envia a ficha inteira ao salvar', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next(null);

      componente.definirNota(8);
      componente.salvar();

      expect(componente.alterada()).toBeFalse();
      expect(ultimoEnvio()).toEqual({
        tmdbId: 1,
        mediaType: 'movie',
        liked: false,
        watched: true,
        rating: 8,
      });
    });

    it('limpa a nota ao clicar de novo no mesmo valor', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next(null);

      componente.definirNota(8);
      componente.definirNota(8);

      expect(componente.nota()).toBeNull();
      componente.salvar();
      expect(ultimoEnvio().rating).toBeUndefined();
    });
  });

  describe('curtida', () => {
    it('curte sem marcar como assistido', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next(null);

      componente.alternarCurtido();

      expect(componente.curtido()).toBeTrue();
      expect(componente.assistido()).toBeFalse();
    });

    it('mantém a curtida ao desmarcar assistido', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next({ ...AVALIACAO, liked: true, watchedAt: '2026-01-01T00:00:00.000Z' });

      componente.alternarAssistido();

      expect(componente.assistido()).toBeFalse();
      expect(componente.curtido()).toBeTrue();
    });
  });

  describe('gravação', () => {
    it('não salva quando nada mudou', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next({ ...AVALIACAO, rating: 6, watchedAt: '2026-01-01T00:00:00.000Z' });

      componente.salvar();

      expect(avaliacoes.salvar).not.toHaveBeenCalled();
    });

    it('mantém o que foi preenchido quando a gravação falha', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next({ ...AVALIACAO, rating: 6, watchedAt: '2026-01-01T00:00:00.000Z' });
      expect(componente.nota()).toBe(6);

      avaliacoes.salvar.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      componente.definirNota(10);
      componente.salvar();

      expect(componente.nota()).toBe(10);
      expect(componente.alterada()).toBeTrue();
      expect(TestBed.inject(ToastService).itens().map((t) => t.tipo)).toEqual(['erro']);
      expect(componente.salvandoFicha()).toBeFalse();
    });

    it('esquece a avaliação quando o backend apaga a ficha vazia', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next({ ...AVALIACAO, rating: 6 });

      avaliacoes.salvar.and.returnValue(of(null));
      componente.apagarFicha();
      componente.apagarFicha();

      expect(componente.avaliacaoId()).toBeNull();
      expect(componente.nota()).toBeNull();
      expect(TestBed.inject(ToastService).itens().map((t) => t.titulo)).toEqual(['Avaliação removida']);
    });

    it('exige confirmação antes de apagar a ficha', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next({ ...AVALIACAO, rating: 6 });

      componente.apagarFicha();

      expect(avaliacoes.salvar).not.toHaveBeenCalled();
      expect(componente.confirmandoExclusao()).toBeTrue();
      expect(componente.nota()).toBe(6);
    });

    it('descarta a avaliação do título anterior', () => {
      abrirTitulo(1);
      abrirTitulo(2);

      cargasDeAvaliacao[0].next({ ...AVALIACAO, rating: 9, content: 'do título antigo' });

      expect(componente.avaliacaoId()).toBeNull();
      expect(componente.texto()).toBe('');
    });
  });

  describe('sincronia com o banner', () => {
    it('traz o assistido do banner sem perder a nota em rascunho', () => {
      abrirTitulo(1);
      cargasDeAvaliacao[0].next(null);
      componente.definirNota(7);

      TestBed.inject(FichaSyncService).avisar(1, 'movie', {});
      cargasDeAvaliacao[1].next({ ...AVALIACAO, liked: true, watchedAt: '2026-01-01T00:00:00.000Z' });

      expect(componente.curtido()).toBeTrue();
      expect(componente.assistido()).toBeTrue();
      expect(componente.nota()).toBe(7);
    });
  });

  describe('compartilhar', () => {
    it('avisa quando o link foi copiado', async () => {
      abrirTitulo(1);
      spyOn(navigator.clipboard, 'writeText').and.resolveTo();

      componente.copiarLink();
      await fixture.whenStable();

      expect(componente.linkCopiado()).toBeTrue();
    });
  });
});
