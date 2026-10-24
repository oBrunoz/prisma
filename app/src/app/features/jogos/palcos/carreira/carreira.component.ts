import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { LucideChevronDown, LucideChevronUp, LucideLock } from '@lucide/angular';
import { environment } from '../../../../../environments/environment';
import { ConteudoCarreira, TENTATIVAS } from '../../../../core/models/jogos.models';
import { ESPECTRO } from '../../../../core/models/espectro';

@Component({
  selector: 'app-carreira',
  standalone: true,
  imports: [LucideChevronDown, LucideChevronUp, LucideLock],
  templateUrl: './carreira.component.html',
  styleUrls: ['./carreira.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarreiraComponent implements OnChanges {
  @Input({ required: true }) conteudo!: ConteudoCarreira;
  @Input() fim = false;
  @Input() ocupado = false;

  @Output() conferir = new EventEmitter<number[]>();

  readonly imagens = environment.tmdbImageUrl;
  readonly espectro = ESPECTRO;
  // volta a ser a da API a cada conferida
  readonly ordem = signal<number[]>([]);
  readonly moveu = signal<number | null>(null);
  readonly conferiu = signal(false);
  readonly tremendo = signal(false);
  private readonly dados = signal<ConteudoCarreira | null>(null);

  readonly linhas = computed(() => {
    const c = this.dados();
    if (!c) return [];
    const porId = new Map(c.ordem.map((f) => [f.tmdbId, f]));
    const ultima = c.conferidas.at(-1);
    return this.ordem().map((id, i) => {
      const f = porId.get(id)!;
      return {
        ...f,
        i,
        errou: this.conferiu() && !!ultima && !ultima[i],
        travou: this.conferiu() && !!ultima && ultima[i],
        sobe: this.destino(i, -1) >= 0,
        desce: this.destino(i, 1) >= 0,
        foraDoLugar: this.fim && !!c.gabarito && c.gabarito[i]?.tmdbId !== id,
      };
    });
  });

  readonly fios = computed(() => {
    const conferidas = this.dados()?.conferidas ?? [];
    return this.espectro.map((cor, i) => ({
      cor,
      estado: i < conferidas.length ? (conferidas[i].every(Boolean) ? 'ok' : 'gasto') : i === conferidas.length && !this.fim ? 'atual' : '',
    }));
  });

  readonly restam = computed(() => TENTATIVAS - (this.dados()?.conferidas.length ?? 0));

  ngOnChanges(mudou: SimpleChanges): void {
    const antes = mudou['conteudo']?.previousValue as ConteudoCarreira | undefined;
    this.dados.set(this.conteudo);
    this.ordem.set(this.conteudo.ordem.map((f) => f.tmdbId));
    const nova = !!antes && this.conteudo.conferidas.length > antes.conferidas.length;
    this.conferiu.set(nova);
    if (nova && !this.conteudo.conferidas.at(-1)?.every(Boolean)) {
      this.tremendo.set(false);
      requestAnimationFrame(() => this.tremendo.set(true));
    }
  }

  // o filme pula os travados: troca com o próximo solto na direção
  private destino(i: number, passo: number): number {
    const c = this.dados();
    if (!c || this.fim) return -1;
    const travados = new Set(c.ordem.filter((f) => f.travado).map((f) => f.tmdbId));
    const ordem = this.ordem();
    if (travados.has(ordem[i])) return -1;
    let j = i + passo;
    while (j >= 0 && j < ordem.length && travados.has(ordem[j])) j += passo;
    return j >= 0 && j < ordem.length ? j : -1;
  }

  mover(i: number, passo: number, evento: Event): void {
    const j = this.destino(i, passo);
    if (j < 0) return;
    const ordem = [...this.ordem()];
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
    this.conferiu.set(false);
    this.ordem.set(ordem);
    this.moveu.set(ordem[j]);
    // o foco acompanha o filme, para dar várias setas seguidas no teclado
    const lista = (evento.currentTarget as HTMLElement).closest('ol');
    requestAnimationFrame(() => {
      const alvo = lista?.children[j]?.querySelector<HTMLButtonElement>(`button[data-passo="${passo}"]:not(:disabled)`);
      alvo?.focus({ preventScroll: true });
    });
  }

  enviar(): void {
    if (this.ocupado || this.fim) return;
    this.conferir.emit(this.ordem());
  }
}
