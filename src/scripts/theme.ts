// Theme toggle: System, Light or Dark, kept in localStorage. "System" follows prefers-color-scheme.
type Theme = 'system' | 'light' | 'dark';
const KEY = 'framelab-theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];

function stored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* storage may be blocked */
  }
  const button = document.getElementById('theme-toggle');
  if (button) button.textContent = `Theme: ${theme[0].toUpperCase()}${theme.slice(1)}`;
}

export function cycleTheme(): void {
  applyTheme(ORDER[(ORDER.indexOf(stored()) + 1) % ORDER.length]);
}

applyTheme(stored());
document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);
