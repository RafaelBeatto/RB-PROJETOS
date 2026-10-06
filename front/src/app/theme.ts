/**
 * Tema da interface: noturno (escuro) ou claro.
 * A escolha fica salva neste navegador; sem escolha, segue o tema do sistema.
 * index.html aplica o tema salvo antes de carregar a aplicação, para não piscar.
 */
import { icon } from '../components/icons';
import { STORAGE_KEYS, readString, writeString } from '../services/storage';
import { onClick } from '../utils/actions';
import { $$ } from '../utils/dom';

export type Theme = 'dark' | 'light';

const THEME_COLOR: Record<Theme, string> = { dark: '#0c0e12', light: '#f3f5f8' };

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Ícone e texto do botão: mostra para qual modo o clique leva. */
function syncButtons(): void {
  const dark = currentTheme() === 'dark';
  const label = dark ? 'Ativar modo claro' : 'Ativar modo noturno';
  $$('[data-action="theme-toggle"]').forEach((b) => {
    b.innerHTML = `${icon(dark ? 'today' : 'moon')}<span class="hide-sm">${dark ? 'Modo claro' : 'Modo noturno'}</span>`;
    b.setAttribute('aria-label', label);
    b.title = label;
  });
}

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  syncButtons();
}

export function initTheme(): void {
  const saved = readString(STORAGE_KEYS.theme);
  applyTheme(saved === 'light' || saved === 'dark' ? saved : systemTheme());
  onClick('theme-toggle', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    writeString(STORAGE_KEYS.theme, next);
    applyTheme(next);
  });
}
