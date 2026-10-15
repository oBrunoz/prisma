import { Injectable, signal } from '@angular/core';

const CHAVE = 'prisma:buscas-recentes';
const MAXIMO = 5;

// fica só neste navegador: é conveniência, não histórico da conta
@Injectable({ providedIn: 'root' })
export class BuscasRecentesService {
  readonly itens = signal<string[]>(this.ler());

  guardar(termo: string): void {
    const limpo = termo.trim();
    if (!limpo) return;

    this.itens.update((lista) =>
      [limpo, ...lista.filter((t) => t.toLowerCase() !== limpo.toLowerCase())].slice(0, MAXIMO),
    );
    this.gravar();
  }

  remover(termo: string): void {
    this.itens.update((lista) => lista.filter((t) => t !== termo));
    this.gravar();
  }

  private ler(): string[] {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
      return Array.isArray(salvo)
        ? salvo.filter((t): t is string => typeof t === 'string').slice(0, MAXIMO)
        : [];
    } catch {
      return [];
    }
  }

  private gravar(): void {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.itens()));
    } catch {
      // navegador sem armazenamento: as recentes valem só nesta visita
    }
  }
}
