import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        paper: '#FFFFFF',
        mutedSurface: '#EEF2F6',
        ink: '#0F172A',
        mutedInk: '#475569',
        hairline: '#CBD5E1',
        hairlineSubtle: '#E2E8F0',
        cobalt: '#0369A1',
        savings: '#047857',
        caution: '#B45309',
        blocker: '#DC2626',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
