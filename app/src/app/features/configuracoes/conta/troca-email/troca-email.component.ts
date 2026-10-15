import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideEye, LucideEyeOff, LucideInfo } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { camposRecusados, ehFalhaDeSistema, mensagemDeErro } from '../../../../core/errors/mensagens';
import { TrocaPendente } from '../../../../core/models/conta.models';
import { ContaService } from '../../../../core/services/conta.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Campos } from '../../../../core/validacao/campos';
import { validarEmail, validarSenhaDigitada } from '../../../../core/validacao/conta';
import { CampoCodigoComponent } from '../../../../shared/components/campo-codigo/campo-codigo.component';

type Campo = 'email' | 'senha';

// duas etapas: senha + e-mail novo, depois o código que chegou nele.
// Até o código voltar, o e-mail antigo continua valendo
@Component({
  selector: 'app-troca-email',
  standalone: true,
  imports: [FormsModule, LucideEye, LucideEyeOff, LucideInfo, CampoCodigoComponent],
  templateUrl: './troca-email.component.html',
})
export class TrocaEmailComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly conta = inject(ContaService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  @Input({ required: true }) emailAtual!: string;
  // pedido que ficou aberto (a página recarregou no meio): já abre no código
  @Input() pendente: TrocaPendente | null = null;
  @Output() trocou = new EventEmitter<string>();
  @Output() fechou = new EventEmitter<void>();

  @ViewChild('primeiro') private primeiro?: ElementRef<HTMLInputElement>;
  @ViewChild(CampoCodigoComponent) private campoCodigo?: CampoCodigoComponent;

  email = signal('');
  senha = signal('');
  verSenha = signal(false);
  enviando = signal(false);
  // por que voltou para a primeira etapa (código vencido, tentativas esgotadas)
  avisoPedido = signal('');

  troca = signal<TrocaPendente | null>(null);
  codigo = signal('');
  erroCodigo = signal('');
  agora = signal(Date.now());

  readonly campos = new Campos<Campo>(() => ({
    email: this.validarNovo(this.email()),
    senha: validarSenhaDigitada(this.senha()),
  }));

  readonly segundosParaReenvio = computed(() => {
    const troca = this.troca();
    return troca ? Math.max(0, Math.ceil((Date.parse(troca.reenvioEm) - this.agora()) / 1000)) : 0;
  });
  readonly venceu = computed(() => {
    const troca = this.troca();
    return !!troca && Date.parse(troca.expiraEm) <= this.agora();
  });

  private relogio?: ReturnType<typeof setInterval>;
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    if (this.pendente) this.irParaCodigo(this.pendente);
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => (this.troca() ? this.campoCodigo?.focar() : this.primeiro?.nativeElement.focus()));
  }

  editar(campo: Campo, valor: string): void {
    (campo === 'email' ? this.email : this.senha).set(valor);
    this.campos.editou(campo);
    this.avisoPedido.set('');
  }

  pedirCodigo(): void {
    if (this.enviando()) return;

    const invalido = this.campos.primeiroInvalido();
    if (invalido) {
      document.getElementById(`troca-${invalido}`)?.focus();
      return;
    }

    this.enviando.set(true);
    this.conta
      .pedirTrocaDeEmail(this.email().trim(), this.senha())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (troca) => {
          this.enviando.set(false);
          this.senha.set('');
          this.irParaCodigo(troca);
          this.depoisDeDesenhar(() => this.campoCodigo?.focar(0));
        },
        error: (falha) => {
          this.enviando.set(false);
          this.recusarPedido(falha);
        },
      });
  }

  confirmar(codigo = this.codigo()): void {
    if (this.enviando() || codigo.length !== 6) return;

    this.enviando.set(true);
    this.erroCodigo.set('');
    this.conta
      .confirmarTrocaDeEmail(codigo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.pararRelogio();
          this.trocou.emit(this.troca()!.email);
        },
        error: (falha) => {
          this.enviando.set(false);
          this.recusarCodigo(falha);
        },
      });
  }

  reenviar(): void {
    if (this.enviando() || this.segundosParaReenvio() > 0) return;

    this.enviando.set(true);
    this.conta
      .reenviarCodigo()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (troca) => {
          this.enviando.set(false);
          this.troca.set(troca);
          this.codigo.set('');
          this.erroCodigo.set('');
          this.depoisDeDesenhar(() => this.campoCodigo?.focar(0));
        },
        error: (falha) => {
          this.enviando.set(false);
          if (falha instanceof HttpErrorResponse && falha.status === 400) {
            this.voltarAoPedido('O pedido venceu. Confirme a senha para receber outro código.');
            return;
          }
          this.toast.erro('Não reenviamos o código', { detalhe: this.mensagemDeEnvio(falha), chave: 'troca-email' });
        },
      });
  }

  // volta com o e-mail já digitado; o pedido novo substitui o anterior
  usarOutroEmail(): void {
    this.voltarAoPedido('');
  }

  cancelar(): void {
    if (this.troca()) this.conta.cancelarTrocaDeEmail().subscribe({ error: () => {} });
    this.pararRelogio();
    this.fechou.emit();
  }

  ngOnDestroy(): void {
    this.pararRelogio();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private irParaCodigo(troca: TrocaPendente): void {
    this.troca.set(troca);
    this.email.set(troca.email);
    this.codigo.set('');
    this.erroCodigo.set('');
    this.agora.set(Date.now());
    this.pararRelogio();
    this.relogio = setInterval(() => this.agora.set(Date.now()), 1000);
  }

  private voltarAoPedido(aviso: string): void {
    this.pararRelogio();
    this.troca.set(null);
    this.avisoPedido.set(aviso);
    this.depoisDeDesenhar(() => document.getElementById(aviso ? 'troca-senha' : 'troca-email')?.focus());
  }

  // o foco espera a etapa nova estar na tela
  private depoisDeDesenhar(acao: () => void): void {
    afterNextRender(acao, { injector: this.injector });
  }

  private pararRelogio(): void {
    if (this.relogio) clearInterval(this.relogio);
    this.relogio = undefined;
  }

  private validarNovo(valor: string): string {
    const erro = validarEmail(valor);
    if (erro) return erro;
    return valor.trim().toLowerCase() === this.emailAtual?.toLowerCase() ? 'Esse já é o seu e-mail.' : '';
  }

  private recusarPedido(falha: unknown): void {
    const status = falha instanceof HttpErrorResponse ? falha.status : -1;

    if (status === 403) {
      this.campos.recusar('senha', 'Senha incorreta.');
    } else if (status === 409) {
      this.campos.recusar('email', 'Esse e-mail já está em uso.');
    } else if (status === 400 && camposRecusados(falha).has('email')) {
      this.campos.recusar('email', 'Confira o e-mail, parece incompleto.');
    } else if (status === 400) {
      this.campos.recusar('email', 'Esse já é o seu e-mail.');
    } else {
      this.toast.erro('Não enviamos o código', { detalhe: this.mensagemDeEnvio(falha), chave: 'troca-email' });
      return;
    }
    document.getElementById(status === 403 ? 'troca-senha' : 'troca-email')?.focus();
  }

  private recusarCodigo(falha: unknown): void {
    if (ehFalhaDeSistema(falha) || !(falha instanceof HttpErrorResponse)) {
      this.toast.erro('Não confirmamos o código', { detalhe: mensagemDeErro(falha), chave: 'troca-email' });
      return;
    }

    if (falha.status === 409) {
      this.campos.recusar('email', 'Esse e-mail passou a ser usado por outra conta.');
      this.voltarAoPedido('');
      return;
    }

    const restantes = falha.error?.restantes;
    if (typeof restantes === 'number' && restantes > 0) {
      this.erroCodigo.set(
        `Código incorreto. ${restantes === 1 ? 'Resta 1 tentativa' : `Restam ${restantes} tentativas`}.`,
      );
      this.codigo.set('');
      // as casas ficaram desativadas durante o envio: o foco espera reativarem
      this.depoisDeDesenhar(() => this.campoCodigo?.focar(0));
      return;
    }

    // tentativas esgotadas ou código vencido: o pedido acabou
    this.voltarAoPedido(
      typeof restantes === 'number'
        ? 'O código errou vezes demais. Confirme a senha para receber outro.'
        : 'O código venceu. Confirme a senha para receber outro.',
    );
  }

  private mensagemDeEnvio(falha: unknown): string {
    return mensagemDeErro(falha, { 503: 'O envio de e-mails está fora do ar. Tente de novo em alguns minutos.' });
  }
}
