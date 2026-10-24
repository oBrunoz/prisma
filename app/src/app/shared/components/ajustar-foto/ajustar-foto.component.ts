import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { LucideRotateCw, LucideX, LucideZoomIn, LucideZoomOut } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { EnquadramentoFoto, PublicUser } from '../../../core/models/auth.models';
import { AuthService } from '../../../core/services/auth.service';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { UsuarioService } from '../../../core/services/usuario.service';

// o recorte sai daqui, então o original pode ser maior que o teto de 5 MB da API
const TAMANHO_MAXIMO = 20 * 1024 * 1024;
export const TIPOS_DE_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

const CIRCULO = 0.86;
const ZOOM_MAXIMO = 4;
// o servidor regrava em 320px: 640 dá folga para a redução não borrar
const LADO_ENVIADO = 640;
// a API recusa a original acima de 5 MB
const LADO_ORIGINAL = 2048;
const ORIGINAL_DIRETO = 4 * 1024 * 1024;

export function problemaNaFoto(arquivo: File): string {
  if (!TIPOS_DE_FOTO.includes(arquivo.type)) return 'Use uma imagem JPG, PNG ou WebP.';
  if (arquivo.size > TAMANHO_MAXIMO) {
    const megas = (arquivo.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    return `Essa imagem tem ${megas} MB. O limite é 20 MB.`;
  }
  return '';
}

// o deslocamento é em diâmetros do círculo: não depende do tamanho do palco nem da imagem
const INICIAL: EnquadramentoFoto = { zoom: 1, x: 0, y: 0, giro: 0 };

const limitar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));

@Component({
  selector: 'app-ajustar-foto',
  standalone: true,
  imports: [LucideX, LucideZoomIn, LucideZoomOut, LucideRotateCw],
  templateUrl: './ajustar-foto.component.html',
})
export class AjustarFotoComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);
  private readonly smoothScroll = inject(SmoothScrollService);

  readonly imagem = input.required<Blob>();
  readonly enquadramento = input<EnquadramentoFoto | null>(null);
  readonly salvou = output<PublicUser>();
  readonly fechou = output<void>();

  readonly previas = [
    { lado: 96, rotulo: 'Perfil' },
    { lado: 48, rotulo: 'Listas' },
    { lado: 36, rotulo: 'Navbar' },
  ];
  readonly zoomMaximo = ZOOM_MAXIMO;
  readonly tiposDeFoto = TIPOS_DE_FOTO.join(',');

  readonly pronta = signal(false);
  readonly zoom = signal(1);
  readonly arrastando = signal(false);
  readonly enviando = signal(false);
  readonly erro = signal('');

  private readonly palco = viewChild.required<ElementRef<HTMLCanvasElement>>('palco');
  private readonly telas = viewChildren<ElementRef<HTMLCanvasElement>>('previa');

  private fonte: Blob | null = null;
  private img: HTMLImageElement | null = null;
  private endereco = '';
  private e: EnquadramentoFoto = { ...INICIAL };
  private toques = new Map<number, { x: number; y: number }>();
  private distancia = 0;
  private observador?: ResizeObserver;
  private destroy$ = new Subject<void>();

  constructor() {
    this.smoothScroll.stop();
  }

  ngOnInit(): void {
    this.carregar(this.imagem(), this.enquadramento());
  }

  ngAfterViewInit(): void {
    this.observador = new ResizeObserver(() => this.desenhar());
    this.observador.observe(this.palco().nativeElement);
  }

  ngOnDestroy(): void {
    this.smoothScroll.start();
    this.observador?.disconnect();
    URL.revokeObjectURL(this.endereco);
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  fechar(): void {
    if (!this.enviando()) this.fechou.emit();
  }

  trocarArquivo(entrada: HTMLInputElement): void {
    const arquivo = entrada.files?.[0];
    // limpa para que escolher o mesmo arquivo de novo dispare outra vez
    entrada.value = '';
    if (!arquivo || this.enviando()) return;
    const problema = problemaNaFoto(arquivo);
    if (problema) {
      this.erro.set(problema);
      return;
    }
    this.carregar(arquivo, null);
  }

  aoTocar(evento: PointerEvent): void {
    if (!this.img) return;
    this.palco().nativeElement.setPointerCapture(evento.pointerId);
    this.toques.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
    if (this.toques.size === 2) this.distancia = this.medirPinca();
    this.arrastando.set(true);
    this.desenhar();
  }

  aoMover(evento: PointerEvent): void {
    const antes = this.toques.get(evento.pointerId);
    if (!antes) return;
    const agora = { x: evento.clientX, y: evento.clientY };
    this.toques.set(evento.pointerId, agora);

    if (this.toques.size === 2) {
      const nova = this.medirPinca();
      if (this.distancia) this.aproximar(this.e.zoom * (nova / this.distancia));
      this.distancia = nova;
      return;
    }

    const diametro = this.diametro();
    this.e.x += (agora.x - antes.x) / diametro;
    this.e.y += (agora.y - antes.y) / diametro;
    this.ajustar();
  }

  aoSoltar(evento: PointerEvent): void {
    this.toques.delete(evento.pointerId);
    this.distancia = 0;
    if (this.toques.size === 0) {
      this.arrastando.set(false);
      this.desenhar();
    }
  }

  aoRolar(evento: WheelEvent): void {
    evento.preventDefault();
    this.aproximar(this.e.zoom * Math.exp(-evento.deltaY * 0.0015));
  }

  aoTeclar(evento: KeyboardEvent): void {
    const passo = 0.02;
    const setas: Record<string, [number, number]> = {
      ArrowLeft: [-passo, 0],
      ArrowRight: [passo, 0],
      ArrowUp: [0, -passo],
      ArrowDown: [0, passo],
    };
    if (setas[evento.key]) {
      this.e.x += setas[evento.key][0];
      this.e.y += setas[evento.key][1];
      this.ajustar();
    } else if (evento.key === '+' || evento.key === '=') {
      this.aproximar(this.e.zoom * 1.1);
    } else if (evento.key === '-') {
      this.aproximar(this.e.zoom / 1.1);
    } else {
      return;
    }
    evento.preventDefault();
  }

  aproximar(zoom: number): void {
    const novo = limitar(zoom, 1, ZOOM_MAXIMO);
    const razao = novo / this.e.zoom;
    this.e.x *= razao;
    this.e.y *= razao;
    this.e.zoom = novo;
    this.ajustar();
  }

  girar(): void {
    this.e.giro = (this.e.giro + 90) % 360;
    this.ajustar();
  }

  usar(): void {
    if (!this.img || this.enviando()) return;

    const tela = document.createElement('canvas');
    tela.width = LADO_ENVIADO;
    tela.height = LADO_ENVIADO;
    const ctx = tela.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    // PNG com transparência não vira preto no JPEG
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, LADO_ENVIADO, LADO_ENVIADO);
    this.pintar(ctx, LADO_ENVIADO, LADO_ENVIADO / 2, LADO_ENVIADO / 2);

    this.enviando.set(true);
    this.erro.set('');
    tela.toBlob(
      (blob) => {
        if (!blob) {
          this.enviando.set(false);
          this.erro.set('Não conseguimos preparar a foto. Tente outra imagem.');
          return;
        }
        this.prepararOriginal()
          .then((original) => this.enviar(blob, original))
          .catch(() => {
            this.enviando.set(false);
            this.erro.set('Não conseguimos preparar a foto. Tente outra imagem.');
          });
      },
      'image/jpeg',
      0.92,
    );
  }

  private carregar(fonte: Blob, enquadramento: EnquadramentoFoto | null): void {
    if (this.endereco) URL.revokeObjectURL(this.endereco);
    this.fonte = fonte;
    this.img = null;
    this.pronta.set(false);
    this.erro.set('');
    this.endereco = URL.createObjectURL(fonte);

    const img = new Image();
    img.onload = () => {
      this.img = img;
      this.e = { ...(enquadramento ?? INICIAL) };
      this.pronta.set(true);
      this.ajustar();
    };
    img.onerror = () => this.erro.set('Não conseguimos abrir essa imagem. Tente outra.');
    img.src = this.endereco;
  }

  private prepararOriginal(): Promise<Blob> {
    const fonte = this.fonte!;
    const img = this.img!;
    const maior = Math.max(img.width, img.height);
    if (fonte.size <= ORIGINAL_DIRETO && maior <= LADO_ORIGINAL && TIPOS_DE_FOTO.includes(fonte.type)) {
      return Promise.resolve(fonte);
    }

    const escala = Math.min(1, LADO_ORIGINAL / maior);
    const tela = document.createElement('canvas');
    tela.width = Math.round(img.width * escala);
    tela.height = Math.round(img.height * escala);
    const ctx = tela.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, tela.width, tela.height);
    ctx.drawImage(img, 0, 0, tela.width, tela.height);
    return new Promise((ok, falhou) =>
      tela.toBlob((blob) => (blob ? ok(blob) : falhou()), 'image/jpeg', 0.9),
    );
  }

  private enviar(recorte: Blob, original: Blob): void {
    this.usuarioService
      .enviarFoto(recorte, { original, enquadramento: { ...this.e } })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuario) => {
          this.enviando.set(false);
          this.auth.usuario.set(usuario);
          this.salvou.emit(usuario);
        },
        error: (falha) => {
          this.enviando.set(false);
          this.erro.set(
            mensagemDeErro(falha, {
              400: 'Não conseguimos ler essa imagem. Use um JPG, PNG ou WebP.',
              413: 'A imagem ficou grande demais. Tente outra.',
            }),
          );
          if (falha instanceof HttpErrorResponse && falha.status === 401) {
            this.auth.pedirLogin('Entre de novo para trocar a foto');
          }
        },
      });
  }

  private medirPinca(): number {
    const [a, b] = [...this.toques.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private diametro(): number {
    return this.palco().nativeElement.clientWidth * CIRCULO;
  }

  private ajustar(): void {
    const imagem = this.img;
    if (!imagem) return;
    const deitada = this.e.giro % 180 !== 0;
    const largura = deitada ? imagem.height : imagem.width;
    const altura = deitada ? imagem.width : imagem.height;
    const menor = Math.min(largura, altura);
    const meiaLargura = ((largura / menor) * this.e.zoom) / 2;
    const meiaAltura = ((altura / menor) * this.e.zoom) / 2;
    this.e.x = limitar(this.e.x, 0.5 - meiaLargura, meiaLargura - 0.5);
    this.e.y = limitar(this.e.y, 0.5 - meiaAltura, meiaAltura - 0.5);
    this.zoom.set(this.e.zoom);
    this.desenhar();
  }

  private pintar(ctx: CanvasRenderingContext2D, diametro: number, cx: number, cy: number): void {
    const imagem = this.img!;
    const escala = (diametro / Math.min(imagem.width, imagem.height)) * this.e.zoom;
    ctx.save();
    ctx.translate(cx + this.e.x * diametro, cy + this.e.y * diametro);
    ctx.rotate((this.e.giro * Math.PI) / 180);
    const largura = imagem.width * escala;
    const altura = imagem.height * escala;
    ctx.drawImage(imagem, -largura / 2, -altura / 2, largura, altura);
    ctx.restore();
  }

  private preparar(tela: HTMLCanvasElement, lado: number): CanvasRenderingContext2D {
    const dpr = window.devicePixelRatio || 1;
    tela.width = Math.round(lado * dpr);
    tela.height = Math.round(lado * dpr);
    const ctx = tela.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    return ctx;
  }

  private desenhar(): void {
    if (!this.img) return;
    const tela = this.palco().nativeElement;
    const lado = tela.clientWidth;
    if (!lado) return;

    const ctx = this.preparar(tela, lado);
    const diametro = lado * CIRCULO;
    const centro = lado / 2;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, lado, lado);
    this.pintar(ctx, diametro, centro, centro);

    ctx.fillStyle = 'rgba(13, 13, 13, 0.72)';
    ctx.beginPath();
    ctx.rect(0, 0, lado, lado);
    ctx.arc(centro, centro, diametro / 2, 0, Math.PI * 2, true);
    ctx.fill();

    if (this.arrastando()) {
      const inicio = centro - diametro / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(centro, centro, diametro / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      for (const terco of [1 / 3, 2 / 3]) {
        ctx.beginPath();
        ctx.moveTo(inicio + diametro * terco, inicio);
        ctx.lineTo(inicio + diametro * terco, inicio + diametro);
        ctx.moveTo(inicio, inicio + diametro * terco);
        ctx.lineTo(inicio + diametro, inicio + diametro * terco);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centro, centro, diametro / 2, 0, Math.PI * 2);
    ctx.stroke();

    this.telas().forEach((previa, i) => {
      const ladoPrevia = this.previas[i].lado;
      this.pintar(this.preparar(previa.nativeElement, ladoPrevia), ladoPrevia, ladoPrevia / 2, ladoPrevia / 2);
    });
  }
}
