import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { environment } from '../../../../../environments/environment';
import { ESPECTRO } from '../../../../core/models/espectro';
import {
  ConteudoAssinatura,
  ConteudoCarreira,
  ConteudoDuelo,
  ConteudoFicha,
  ConteudoLegenda,
  ConteudoLetreiro,
  ConteudoLinha,
  ConteudoPersonagens,
  Partida,
} from '../../../../core/models/jogos.models';
import { PosterListrasComponent } from '../../../../shared/components/poster-listras/poster-listras.component';

// só o que a primeira tentativa já mostra, nada além
@Component({
  selector: 'app-capa-jogo',
  standalone: true,
  imports: [PosterListrasComponent],
  templateUrl: './capa-jogo.component.html',
  styleUrls: ['./capa-jogo.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapaJogoComponent {
  private readonly p = signal<Partida | null>(null);

  @Input({ required: true }) set partida(valor: Partida) {
    this.p.set(valor);
  }

  readonly imagens = environment.tmdbImageUrl;
  readonly espectro = ESPECTRO;
  readonly larguras = ['70%', '88%', '62%', '54%'];

  readonly kind = computed(() => this.p()?.kind);
  readonly imagem = computed(() => this.p()?.images[0] ?? null);
  readonly ficha = computed(() => this.p()?.content as ConteudoFicha);
  readonly personagens = computed(() => this.p()?.content as ConteudoPersonagens);
  readonly assinatura = computed(() => this.p()?.content as ConteudoAssinatura);
  readonly carreira = computed(() => this.p()?.content as ConteudoCarreira);
  readonly duelo = computed(() => (this.p()?.content as ConteudoDuelo)?.duelos[0] ?? null);
  readonly linha = computed(() => this.p()?.content as ConteudoLinha);

  readonly letreiro = computed(() => {
    const c = this.p()?.content as ConteudoLetreiro | undefined;
    if (!c) return [];
    const palavras: string[][] = [[]];
    for (const { c: ch } of c.letras) {
      if (ch === ' ') palavras.push([]);
      else palavras[palavras.length - 1].push(ch);
    }
    return palavras.filter((p) => p.length).slice(0, 2);
  });

  readonly legenda = computed(() => {
    const c = this.p()?.content as ConteudoLegenda | undefined;
    return Array.from({ length: c?.tamanho ?? 5 }, (_, i) => i);
  });
}
