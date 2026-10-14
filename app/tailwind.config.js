const plugin = require('tailwindcss/plugin');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts}',
  ],
  // hover: só vale com mouse; no toque o estado não "gruda" depois do tap
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // vermelho da marca Prisma (#E63946) no lugar dos tons de red usados no app
        red: {
          400: '#F07A83',
          500: '#EB5A65',
          600: '#E63946',
          700: '#C92A37',
        },
        // erro de campo e de toast: o trecho quente do espectro, sem brigar com o vermelho de ação
        coral: '#D85057',
      },
      // margem lateral das seções, definida em styles.css (--gutter) por breakpoint
      spacing: {
        gutter: 'var(--gutter)',
      },
    },
  },
  plugins: [
    // decidir pelo tipo de ponteiro, não pela largura: tablet grande também é toque
    plugin(({ addVariant }) => {
      addVariant('mouse', '@media (hover: hover) and (pointer: fine)');
      addVariant('toque', '@media not all and (hover: hover) and (pointer: fine)');
    }),
  ],
};
