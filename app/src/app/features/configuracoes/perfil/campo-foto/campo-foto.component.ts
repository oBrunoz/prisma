import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { LucideImageUp } from '@lucide/angular';
import { Subject, takeUntil } from 'rxjs';
import { mensagemDeErro } from '../../../../core/errors/mensagens';
import { PublicUser } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { UsuarioService } from '../../../../core/services/usuario.service';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

// o mesmo teto da API; aqui ele só poupa o envio de algo que seria recusado
const TAMANHO_MAXIMO = 5 * 1024 * 1024;
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

// a foto é enviada assim que escolhida: não depende do "Salvar perfil"
@Component({
  selector: 'app-campo-foto',
  standalone: true,
  imports: [UserAvatarComponent, LucideImageUp],
  templateUrl: './campo-foto.component.html',
})
export class CampoFotoComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);

  readonly tiposAceitos = TIPOS_ACEITOS.join(',');
  readonly arrastando = signal(false);
  readonly enviando = signal(false);
  readonly erro = signal('');

  // dragleave dispara ao passar por cima de cada filho: conta entradas e saídas
  private profundidade = 0;
  private destroy$ = new Subject<void>();

  aoEntrar(evento: DragEvent): void {
    if (!this.temArquivo(evento)) return;
    evento.preventDefault();
    this.profundidade++;
    this.arrastando.set(true);
  }

  aoPassar(evento: DragEvent): void {
    if (!this.temArquivo(evento)) return;
    // sem isto o navegador abre a imagem no lugar do site
    evento.preventDefault();
    if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'copy';
  }

  aoSair(): void {
    this.profundidade = Math.max(0, this.profundidade - 1);
    if (this.profundidade === 0) this.arrastando.set(false);
  }

  aoSoltar(evento: DragEvent): void {
    evento.preventDefault();
    this.profundidade = 0;
    this.arrastando.set(false);
    const arquivo = evento.dataTransfer?.files?.[0];
    if (arquivo) this.enviar(arquivo);
  }

  aoEscolher(entrada: HTMLInputElement): void {
    const arquivo = entrada.files?.[0];
    // limpa para que escolher o mesmo arquivo de novo dispare outra vez
    entrada.value = '';
    if (arquivo) this.enviar(arquivo);
  }

  tirar(): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.erro.set('');

    this.usuarioService
      .tirarFoto()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (usuario) => this.aplicar(usuario),
        error: (falha) => {
          this.enviando.set(false);
          this.erro.set(mensagemDeErro(falha));
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private enviar(arquivo: File): void {
    if (this.enviando()) return;

    if (!TIPOS_ACEITOS.includes(arquivo.type)) {
      this.erro.set('Use uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO) {
      this.erro.set(`Essa imagem tem ${this.megas(arquivo.size)}. O limite é 5 MB.`);
      return;
    }

    this.enviando.set(true);
    this.erro.set('');

    this.usuarioService
      .enviarFoto(arquivo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        // a foto nova aparece na hora, aqui e na navbar: não precisa de aviso
        next: (usuario) => this.aplicar(usuario),
        error: (falha) => {
          this.enviando.set(false);
          const status = falha instanceof HttpErrorResponse ? falha.status : -1;
          this.erro.set(
            mensagemDeErro(falha, {
              400: 'Não conseguimos ler essa imagem. Use um JPG, PNG ou WebP.',
              413: 'A imagem passa de 5 MB.',
            }),
          );
          if (status === 401) this.auth.pedirLogin('Entre de novo para trocar a foto');
        },
      });
  }

  private aplicar(usuario: PublicUser): void {
    this.enviando.set(false);
    this.auth.usuario.set(usuario);
  }

  private temArquivo(evento: DragEvent): boolean {
    return !!evento.dataTransfer?.types.includes('Files');
  }

  private megas(bytes: number): string {
    return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
  }
}
