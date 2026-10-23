// único canal fora do site, para o que a pessoa não resolve sozinha em Configurações (a LGPD pede um)
export const CONTATO_EMAIL = 'contato@prismadot.com.br';

export const ATUALIZADO_EM = '22 de outubro de 2026';

export interface SecaoLegal {
  id: string;
  titulo: string;
}

export interface OutraPagina {
  rota: string;
  rotulo: string;
}
