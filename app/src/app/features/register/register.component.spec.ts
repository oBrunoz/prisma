import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let componente: RegisterComponent;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['cadastrar']);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  function preencher(): void {
    componente.editar('name', 'Bruno');
    componente.editar('username', 'bruno');
    componente.editar('email', 'bruno@email.com');
    componente.editar('password', '12345678');
  }

  function falhar(status: number, message: string | string[]): void {
    auth.cadastrar.and.returnValue(throwError(() => new HttpErrorResponse({ status, error: { message } })));
    componente.onSubmit();
  }

  it('não envia e mostra o erro de cada campo vazio', () => {
    componente.onSubmit();

    expect(auth.cadastrar).not.toHaveBeenCalled();
    expect(componente.campos.erro('name')).toBe('Informe seu nome.');
    expect(componente.campos.erro('password')).toBe('Crie uma senha.');
  });

  it('só acusa o campo que o servidor recusou', () => {
    preencher();
    falhar(400, ['username aceita apenas letras minusculas, numeros e underscore']);

    // "username" contém "name": os dois campos não podem acender juntos
    expect(componente.campos.erro('username')).toBeTruthy();
    expect(componente.campos.erro('name')).toBe('');
  });

  it('aponta o e-mail no conflito e some quando o usuário edita', () => {
    preencher();
    falhar(409, 'E-mail ja cadastrado');

    expect(componente.campos.erro('email')).toBe('E-mail já em uso.');
    expect(componente.emailJaCadastrado()).toBeTrue();

    componente.editar('email', 'outro@email.com');
    expect(componente.campos.erro('email')).toBe('');
  });

  it('manda falha de conexão para o toast', () => {
    preencher();
    falhar(0, '');

    expect(TestBed.inject(ToastService).itens().map((t) => t.tipo)).toEqual(['erro']);
    expect(componente.erroGeral()).toBe('');
  });

  it('deixa o nome de usuário minúsculo e sem espaço', () => {
    componente.editar('username', 'Bruno Alencar');
    expect(componente.username()).toBe('brunoalencar');
  });
});
