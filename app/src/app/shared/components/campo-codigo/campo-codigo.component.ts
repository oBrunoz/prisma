import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';

const CASAS = 6;

// seis casas de um dígito; colar o código inteiro preenche todas
@Component({
  selector: 'app-campo-codigo',
  standalone: true,
  templateUrl: './campo-codigo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampoCodigoComponent {
  // guarda o próprio valor: digitando rápido, a tecla seguinte chega antes de o pai devolver o anterior
  private atual = '';
  @Input() set valor(valor: string) {
    this.atual = valor ?? '';
  }
  get valor(): string {
    return this.atual;
  }
  @Input() invalido = false;
  @Input() desativado = false;
  @Input() descricao: string | null = null;
  @Output() valorChange = new EventEmitter<string>();
  // dispara quando a sexta casa é preenchida
  @Output() completo = new EventEmitter<string>();

  @ViewChildren('casa') private casas!: QueryList<ElementRef<HTMLInputElement>>;

  readonly indices = Array.from({ length: CASAS }, (_, i) => i);

  digito(i: number): string {
    return this.valor[i] ?? '';
  }

  focar(i = Math.min(this.valor.length, CASAS - 1)): void {
    const alvo = this.casas?.get(Math.max(0, Math.min(i, CASAS - 1)))?.nativeElement;
    alvo?.focus();
    alvo?.select();
  }

  aoDigitar(i: number, evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const digitos = campo.value.replace(/\D/g, '');

    // o que não é dígito nem entra
    if (!digitos) {
      campo.value = this.digito(i);
      return;
    }

    // digitar adiante de uma casa vazia escreve na primeira vazia
    const inicio = Math.min(i, this.valor.length);
    const casas = this.valor.padEnd(CASAS, ' ').split('');
    digitos
      .slice(0, CASAS - inicio)
      .split('')
      .forEach((d, n) => (casas[inicio + n] = d));
    this.emitir(casas.join('').trimEnd());
    campo.value = this.digito(i);
    this.focar(inicio + digitos.length);
  }

  aoTeclar(i: number, evento: KeyboardEvent): void {
    if (evento.key === 'Backspace' && !this.digito(i) && i > 0) {
      evento.preventDefault();
      this.emitir(this.valor.slice(0, i - 1));
      this.focar(i - 1);
    } else if (evento.key === 'Backspace') {
      evento.preventDefault();
      this.emitir(this.valor.slice(0, i) + this.valor.slice(i + 1));
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.focar(i - 1);
    } else if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.focar(i + 1);
    }
  }

  private emitir(valor: string): void {
    this.atual = valor;
    this.valorChange.emit(valor);
    if (valor.length === CASAS) this.completo.emit(valor);
  }
}
