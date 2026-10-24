import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { LucideImageUp, LucidePencil } from '@lucide/angular';
import { Subject, catchError, forkJoin, map, takeUntil, throwError } from 'rxjs';
import { mensagemDeErro } from '../../../../core/errors/mensagens';
import { EnquadramentoFoto, PublicUser } from '../../../../core/models/auth.models';
import { AuthService } from '../../../../core/services/auth.service';
import { UsuarioService } from '../../../../core/services/usuario.service';
import {
  AjustarFotoComponent,
  TIPOS_DE_FOTO,
  problemaNaFoto,
} from '../../../../shared/components/ajustar-foto/ajustar-foto.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

// a foto escolhida abre no ajuste e vai de lá: não depende do "Salvar perfil"
@Component({
  selector: 'app-campo-foto',
  standalone: true,
  imports: [UserAvatarComponent, AjustarFotoComponent, LucideImageUp, LucidePencil],
  templateUrl: './campo-foto.component.html',
})
export class CampoFotoComponent implements OnDestroy {
  readonly auth = inject(AuthService);
  private readonly usuarioService = inject(UsuarioService);

  readonly tiposAceitos = TIPOS_DE_FOTO.join(',');
  readonly ajustando = signal<{ imagem: Blob; enquadramento: EnquadramentoFoto | null } | null>(null);
  readonly abrindo = signal(false);
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
    if (arquivo) this.ajustar(arquivo);
  }

  aoEscolher(entrada: HTMLInputElement): void {
    const arquivo = entrada.files?.[0];
    // limpa para que escolher o mesmo arquivo de novo dispare outra vez
    entrada.value = '';
    if (arquivo) this.ajustar(arquivo);
  }

  editar(entrada: HTMLInputElement): void {
    const avatarUrl = this.auth.usuario()?.avatarUrl;
    if (!avatarUrl) {
      entrada.click();
      return;
    }
    if (this.abrindo() || this.enviando()) return;
    this.abrindo.set(true);
    this.erro.set('');

    forkJoin({
      imagem: this.usuarioService.fotoOriginal(),
      enquadramento: this.usuarioService.enquadramentoDaFoto(),
    })
      .pipe(
        // foto enviada antes de guardarmos a original: reabre o próprio recorte
        catchError((falha) =>
          falha instanceof HttpErrorResponse && falha.status === 404
            ? this.usuarioService.fotoAtual(avatarUrl).pipe(map((imagem) => ({ imagem, enquadramento: null })))
            : throwError(() => falha),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (ajuste) => {
          this.abrindo.set(false);
          this.ajustando.set(ajuste);
        },
        error: (falha) => {
          this.abrindo.set(false);
          this.erro.set(mensagemDeErro(falha));
        },
      });
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

  private ajustar(arquivo: File): void {
    if (this.enviando()) return;
    const problema = problemaNaFoto(arquivo);
    this.erro.set(problema);
    if (!problema) this.ajustando.set({ imagem: arquivo, enquadramento: null });
  }

  private aplicar(usuario: PublicUser): void {
    this.enviando.set(false);
    this.auth.usuario.set(usuario);
  }

  private temArquivo(evento: DragEvent): boolean {
    return !!evento.dataTransfer?.types.includes('Files');
  }
}
