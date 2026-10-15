// uma carga da home passa de 25 requisições ao proxy: teto baixo derruba
// navegação normal antes de atrapalhar qualquer abuso
export const LIMITE_GERAL = { ttl: 60_000, limit: 600 };

export const LIMITE_TMDB = { ttl: 60_000, limit: 300 };

// aqui o alvo é força bruta, e ninguém tenta entrar 6 vezes por minuto
export const LIMITE_LOGIN = { ttl: 60_000, limit: 5 };

// cada pedido manda um e-mail de verdade: o teto protege a caixa de quem
// recebe e a cota do provedor
export const LIMITE_ENVIO_EMAIL = { ttl: 60_000, limit: 3 };
