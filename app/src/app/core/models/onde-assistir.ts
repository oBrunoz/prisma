import { WatchProviderCountry } from './tmdb.models';

export interface Plataforma {
  id: number;
  nome: string;
  logoPath: string | null;
}

export interface OndeAssistir {
  // só o que entra sem pagar à parte: assinatura, grátis e com anúncios
  plataformas: Plataforma[];
  // sem plataforma e estreou há pouco: ainda está no cinema
  nosCinemas: boolean;
}

const DIAS_DE_CINEMA = 120;

// a TMDB repete o serviço em variantes ("... with Ads", "... Amazon Channel", "... Premium"); sem o sufixo viram um só
const VARIANTE = /\s+(standard with ads|basic with ads|with ads|amazon channel|apple tv channel|roku premium channel|premium)$/i;

const NOMES: Record<string, string> = {
  'Amazon Prime Video': 'Prime Video',
  'Disney Plus': 'Disney+',
  'Paramount Plus': 'Paramount+',
  'Apple TV Plus': 'Apple TV+',
};

export function ondeAssistir(pais: WatchProviderCountry | null | undefined, estreia?: string | null): OndeAssistir {
  const vistos = new Set<string>();
  const plataformas = [...(pais?.flatrate ?? []), ...(pais?.free ?? []), ...(pais?.ads ?? [])]
    .sort((a, b) => a.display_priority - b.display_priority)
    .flatMap((p) => {
      const base = p.provider_name.replace(VARIANTE, '').trim();
      const nome = NOMES[base] ?? base;
      if (vistos.has(nome)) return [];
      vistos.add(nome);
      return [{ id: p.provider_id, nome, logoPath: p.logo_path }];
    });

  return { plataformas, nosCinemas: plataformas.length === 0 && estreouHaPouco(estreia) };
}

function estreouHaPouco(estreia?: string | null): boolean {
  if (!estreia) return false;
  const dias = (Date.now() - new Date(estreia).getTime()) / 86_400_000;
  return dias >= 0 && dias <= DIAS_DE_CINEMA;
}
