import { Component, HostListener, OnDestroy, OnInit, inject, input, model, output, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { UsuarioResumo } from '../../../core/models/auth.models';
import { SmoothScrollService } from '../../../core/services/smooth-scroll.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { LinhaUsuarioComponent } from '../linha-usuario/linha-usuario.component';

export type AbaSeguidores = 'seguidores' | 'seguindo';

interface EstadoAba {
  itens: UsuarioResumo[];
  pagina: number;
  carregando: boolean;
  erro: string;
  fim: boolean;
}

const POR_PAGINA = 20;

const vazio = (): EstadoAba => ({ itens: [], pagina: 0, carregando: false, erro: '', fim: false });

@Component({
  selector: 'app-seguidores-modal',
  standalone: true,
  imports: [LinhaUsuarioComponent, LucideX],
  templateUrl: './seguidores-modal.component.html',
})
export class SeguidoresModalComponent implements OnInit, OnDestroy {
  private readonly usuarioService = inject(UsuarioService);
  private readonly smoothScroll = inject(SmoothScrollService);

  readonly usuarioId = input.required<string>();
  readonly username = input.required<string>();
  readonly contagem = input.required<{ seguidores: number; seguindo: number }>();
  readonly aba = model<AbaSeguidores>('seguidores');
  readonly fechou = output<void>();

  readonly estados = signal<Record<AbaSeguidores, EstadoAba>>({
    seguidores: vazio(),
    seguindo: vazio(),
  });

  private destroy$ = new Subject<void>();

  constructor() {
    this.smoothScroll.stop();
  }

  ngOnInit(): void {
    this.carregar(this.aba());
  }

  ngOnDestroy(): void {
    this.smoothScroll.start();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  fechar(): void {
    this.fechou.emit();
  }

  trocar(aba: AbaSeguidores): void {
    this.aba.set(aba);
    if (this.estados()[aba].pagina === 0) this.carregar(aba);
  }

  carregar(aba: AbaSeguidores): void {
    const atual = this.estados()[aba];
    if (atual.carregando || atual.fim) return;

    this.atualizar(aba, { carregando: true, erro: '' });

    const proxima = atual.pagina + 1;
    const pedido =
      aba === 'seguidores'
        ? this.usuarioService.seguidores(this.usuarioId(), proxima, POR_PAGINA)
        : this.usuarioService.seguindoPor(this.usuarioId(), proxima, POR_PAGINA);

    pedido.pipe(takeUntil(this.destroy$)).subscribe({
      next: (lista) =>
        this.atualizar(aba, {
          itens: [...this.estados()[aba].itens, ...lista],
          pagina: proxima,
          carregando: false,
          fim: lista.length < POR_PAGINA,
        }),
      error: (falha) => this.atualizar(aba, { carregando: false, erro: mensagemDeErro(falha) }),
    });
  }

  private atualizar(aba: AbaSeguidores, mudancas: Partial<EstadoAba>): void {
    this.estados.update((e) => ({ ...e, [aba]: { ...e[aba], ...mudancas } }));
  }
}
