// uma carga da home passa de 25 requisições: teto baixo derruba a navegação normal
export const LIMITE_GERAL = { ttl: 60_000, limit: 600 };

export const LIMITE_TMDB = { ttl: 60_000, limit: 300 };

// aqui o alvo é força bruta, e ninguém tenta entrar 6 vezes por minuto
export const LIMITE_LOGIN = { ttl: 60_000, limit: 5 };

// cada pedido manda um e-mail de verdade: protege a caixa de quem recebe e a cota do provedor
export const LIMITE_ENVIO_EMAIL = { ttl: 60_000, limit: 3 };

// cada envio passa a imagem pelo sharp: o teto evita usar o servidor de conversor
export const LIMITE_FOTO = { ttl: 60_000, limit: 10 };
