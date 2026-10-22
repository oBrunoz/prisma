<p align="center">
  <img src="docs/readme/capa-vitrine.webp" alt="Prisma — a home no notebook, os detalhes e os jogos no celular" width="100%">
</p>

<p align="center">
  <b>Acompanhe, avalie e organize tudo que você assiste.</b><br>
  Catálogo de filmes e séries com diário, notas, watchlist, perfil social e jogos diários.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-20-45417C?style=flat-square&labelColor=1a1a1a&logo=angular&logoColor=white" alt="Angular 20">
  <img src="https://img.shields.io/badge/Tailwind-3-2880A8?style=flat-square&labelColor=1a1a1a&logo=tailwindcss&logoColor=white" alt="Tailwind 3">
  <img src="https://img.shields.io/badge/NestJS-12-78C4C4?style=flat-square&labelColor=1a1a1a&logo=nestjs&logoColor=white" alt="NestJS 12">
  <img src="https://img.shields.io/badge/Prisma-7-F0E0C5?style=flat-square&labelColor=1a1a1a&logo=prisma&logoColor=white" alt="Prisma 7">
  <img src="https://img.shields.io/badge/PostgreSQL-ECA352?style=flat-square&labelColor=1a1a1a&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/TMDB-API-D85057?style=flat-square&labelColor=1a1a1a&logo=themoviedatabase&logoColor=white" alt="TMDB">
  <img src="https://img.shields.io/badge/status-em%20desenvolvimento-942548?style=flat-square&labelColor=1a1a1a" alt="Em desenvolvimento">
</p>

<img src="docs/readme/fios.webp" alt="" width="100%">

O **Prisma** é um diário de cinema e TV. Você encontra qualquer filme ou série, marca o que
já viu, dá nota, escreve o que achou e guarda o que quer ver depois. Seu perfil mostra
tudo isso para quem quiser acompanhar. Os dados de filmes, séries e pessoas vêm da
[TMDB](https://www.themoviedb.org/).

## Descubra o que assistir

A home abre com um destaque que toca o trailer e segue com fileiras do que está em alta,
nos cinemas e para estrear. A busca encontra filmes, séries, pessoas e usuários (com `@nome`).

<table>
  <tr>
    <td width="50%"><img src="docs/readme/tela-home.webp" alt="Home com as fileiras de pôsteres"></td>
    <td width="50%"><img src="docs/readme/tela-busca.webp" alt="Resultados da busca"></td>
  </tr>
</table>

## Tudo sobre um título

Cada filme e série tem sinopse, elenco, temporadas, onde assistir e as notas da TMDB e de
quem usa o Prisma. Clicando em alguém do elenco você chega na página da pessoa.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/tela-detalhes.webp" alt="Página de detalhes de uma série"></td>
    <td width="50%"><img src="docs/readme/tela-pessoa.webp" alt="Página de uma pessoa do elenco"></td>
  </tr>
</table>

## Seu diário

- Marque como assistido, curta ou guarde na watchlist direto do pôster.
- Avalie de 1 a 10, escreva uma resenha e registre o dia em que assistiu.
- Monte o perfil com foto, capa e seus quatro filmes favoritos.
- Siga outras pessoas e veja o que elas andam assistindo.

## Jogos diários

Todo dia sai um desafio novo em cada jogo, o mesmo para todo mundo. Você tem sete
tentativas para acertar o filme. Com conta, dá para jogar desafios de dias anteriores.

<table>
  <tr>
    <td width="50%"><img src="docs/readme/tela-frames.webp" alt="Jogo Frames"></td>
    <td width="50%"><img src="docs/readme/tela-poster.webp" alt="Jogo Pôster"></td>
  </tr>
  <tr>
    <td valign="top"><b>Frames</b><br><sub>Sete cenas do filme, da mais difícil para a mais fácil. A cada erro aparece a próxima.</sub></td>
    <td valign="top"><b>Pôster</b><br><sub>O pôster redesenhado em listras coloridas. A cada erro as faixas afinam e a imagem fica mais nítida.</sub></td>
  </tr>
</table>

## No celular

Todas as telas foram pensadas também para celular e tablet.

<p align="center">
  <img src="docs/readme/celulares.webp" alt="Home, detalhes e o jogo Pôster no celular" width="100%">
</p>

## Rodando localmente

Você vai precisar de Node 20.19+, um PostgreSQL rodando e uma
[chave da API da TMDB](https://www.themoviedb.org/settings/api).

```bash
git clone https://github.com/oBrunoz/spectral.git prisma
cd prisma
```

**API**

```bash
cd api
npm install
cp .env.example .env      # preencha DATABASE_URL, JWT_SECRET e TMDB_API_KEY
npx prisma migrate dev
npx prisma generate
npm run jogos:importar    # carrega os desafios dos jogos
npm run start:dev         # http://localhost:3000
```

**App**

```bash
cd app
npm install
npm start                 # http://localhost:4200
```

<img src="docs/readme/fios.webp" alt="" width="100%">

<p align="center">
  <img src="app/public/brand/favicon.svg" alt="" width="40"><br>
  <sub>Dados de filmes e séries fornecidos pela <a href="https://www.themoviedb.org/">TMDB</a>.
  Este projeto usa a API da TMDB, mas não é endossado nem certificado por ela.</sub>
</p>
