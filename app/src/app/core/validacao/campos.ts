import { computed, signal } from '@angular/core';

// o erro da regra aparece ao sair do campo ou enviar; o do servidor, na hora, até mexer no campo
export class Campos<C extends string> {
  private readonly tocados = signal<ReadonlySet<C>>(new Set());
  private readonly tentouEnviar = signal(false);
  private readonly doServidor = signal<Partial<Record<C, string>>>({});

  private readonly regras = computed(() => this.validar());

  // a ordem das chaves em `validar` é a ordem dos campos na tela
  constructor(private readonly validar: () => Record<C, string>) {}

  erro(campo: C): string {
    const servidor = this.doServidor()[campo];
    if (servidor) return servidor;
    return this.tentouEnviar() || this.tocados().has(campo) ? this.regras()[campo] : '';
  }

  tocar(campo: C): void {
    this.tocados.update((atuais) => new Set(atuais).add(campo));
  }

  editou(campo: C): void {
    if (!this.doServidor()[campo]) return;
    this.doServidor.update((atuais) => {
      const resto = { ...atuais };
      delete resto[campo];
      return resto;
    });
  }

  recusar(campo: C, mensagem: string): void {
    this.doServidor.update((atuais) => ({ ...atuais, [campo]: mensagem }));
  }

  // marca a tentativa e devolve o primeiro campo inválido, para receber o foco
  primeiroInvalido(): C | null {
    this.tentouEnviar.set(true);
    const regras = this.regras();
    return (Object.keys(regras) as C[]).find((campo) => regras[campo]) ?? null;
  }
}
