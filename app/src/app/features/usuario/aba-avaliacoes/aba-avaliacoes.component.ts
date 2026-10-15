import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../core/errors/mensagens';
import { AvaliacaoUsuario } from '../../../core/models/catalogo.models';
import { AvaliacaoService } from '../../../core/services/avaliacao.service';
import { CartaoAvaliacaoComponent } from '../../../shared/components/cartao-avaliacao/cartao-avaliacao.component';

const POR_PAGINA = 20;

@Component({
  selector: 'app-aba-avaliacoes',
  standalone: true,
  imports: [CartaoAvaliacaoComponent],
  templateUrl: './aba-avaliacoes.component.html',
})
export class AbaAvaliacoesComponent implements OnInit, OnDestroy {
  private readonly avaliacaoService = inject(AvaliacaoService);

  readonly userId = input.required<string>();
  readonly username = input.required<string>();
  readonly souEu = input(false);
  readonly excluiu = output<void>();

  readonly itens = signal<AvaliacaoUsuario[]>([]);
  readonly pagina = signal(0);
  readonly carregando = signal(false);
  readonly erro = signal('');
  readonly fim = signal(false);

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregar(): void {
    if (this.carregando() || this.fim()) return;
    this.carregando.set(true);
    this.erro.set('');

    const proxima = this.pagina() + 1;
    this.avaliacaoService
      .porUsuario(this.userId(), POR_PAGINA, 'escritas', proxima)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.itens.update((atuais) => [...atuais, ...lista]);
          this.pagina.set(proxima);
          this.fim.set(lista.length < POR_PAGINA);
          this.carregando.set(false);
        },
        error: (falha) => {
          this.erro.set(mensagemDeErro(falha));
          this.carregando.set(false);
        },
      });
  }

  tirar(avaliacao: AvaliacaoUsuario): void {
    this.itens.update((lista) => lista.filter((a) => a.id !== avaliacao.id));
    this.excluiu.emit();
  }
}
