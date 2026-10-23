export interface Enfeite {
  capa: { src: string; };
  fixa: { src: string; marca: string; legenda: string };
  recado: string;
}

export const ENFEITES: Record<string, Enfeite> = {
  m_clarasd: {
    capa: { src: 'https://midia.prismadot.com.br/enfeites/junho.jpg' },
    fixa: {
      src: 'https://midia.prismadot.com.br/enfeites/janeiro.jpg',
      marca: '17/10',
      legenda: '2026',
    },
    recado: 'Para você sempre lembrar que te amo!',
  }
};
