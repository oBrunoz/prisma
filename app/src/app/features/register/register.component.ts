import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideEye, LucideEyeOff, LucideLock, LucideMail, LucideUser } from '@lucide/angular';
import {
  camposRecusados,
  ehFalhaDeSistema,
  erroMenciona,
  mensagemDeErro,
} from '../../core/errors/mensagens';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { Campos } from '../../core/validacao/campos';
import {
  validarEmail,
  validarNome,
  validarSenhaNova,
  validarUsername,
} from '../../core/validacao/conta';
import { TravessiaComponent } from '../../shared/components/travessia/travessia.component';

type Campo = 'name' | 'username' | 'email' | 'password';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    LucideUser,
    LucideMail,
    LucideLock,
    LucideEye,
    LucideEyeOff,
    TravessiaComponent,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  name = signal('');
  username = signal('');
  email = signal('');
  password = signal('');
  showPassword = signal(false);
  enviando = signal(false);
  erroGeral = signal('');
  emailJaCadastrado = signal(false);

  readonly campos = new Campos<Campo>(() => ({
    name: validarNome(this.name()),
    username: validarUsername(this.username()),
    email: validarEmail(this.email()),
    password: validarSenhaNova(this.password()),
  }));

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  editar(campo: Campo, valor: string): void {
    // o handle vira URL: já entra minúsculo e sem espaço, como a API guarda
    const valores = { name: this.name, username: this.username, email: this.email, password: this.password };
    valores[campo].set(campo === 'username' ? valor.toLowerCase().replace(/\s/g, '') : valor);
    this.campos.editou(campo);
    this.erroGeral.set('');
    if (campo === 'email') this.emailJaCadastrado.set(false);
  }

  onSubmit(): void {
    if (this.enviando()) return;

    const invalido = this.campos.primeiroInvalido();
    if (invalido) {
      document.getElementById(invalido)?.focus();
      return;
    }

    this.enviando.set(true);
    this.erroGeral.set('');

    this.auth
      .cadastrar({
        name: this.name().trim(),
        username: this.username(),
        email: this.email().trim(),
        password: this.password(),
      })
      .subscribe({
        next: () => {
          const destino = this.rota.snapshot.queryParamMap.get('redirect') ?? '/';
          void this.router.navigateByUrl(destino);
        },
        error: (falha) => {
          this.enviando.set(false);
          this.tratarFalha(falha);
        },
      });
  }

  private tratarFalha(falha: unknown): void {
    if (ehFalhaDeSistema(falha)) {
      this.toast.erro('Não criamos sua conta', { detalhe: mensagemDeErro(falha), chave: 'cadastro' });
      return;
    }

    const status = falha instanceof HttpErrorResponse ? falha.status : -1;

    if (status === 409) {
      if (erroMenciona(falha, 'usuario')) {
        this.campos.recusar('username', 'Esse nome de usuário já está em uso.');
      } else {
        this.campos.recusar('email', 'E-mail já em uso.');
        this.emailJaCadastrado.set(true);
      }
      return;
    }

    if (status === 400) {
      const recusados = camposRecusados(falha);
      const mensagens: Record<Campo, string> = {
        name: 'Use de 2 a 80 caracteres.',
        username: 'Use de 3 a 20 caracteres: letras minúsculas, números e _.',
        email: 'Confira o e-mail, parece incompleto.',
        password: 'Use de 8 a 128 caracteres.',
      };
      const campos = (Object.keys(mensagens) as Campo[]).filter((c) => recusados.has(c));
      campos.forEach((c) => this.campos.recusar(c, mensagens[c]));
      if (campos.length) return;
    }

    this.erroGeral.set(mensagemDeErro(falha));
  }
}
