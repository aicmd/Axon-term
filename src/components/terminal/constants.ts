import type { ITheme } from '@xterm/xterm'

/**
 * Xterm terminal themes, matching the app's Catppuccin Mocha dark theme
 * and a clean light theme. Centralised here to avoid duplication.
 */
export const XTERM_THEMES: Record<'dark' | 'light', ITheme> = {
  dark: {
    background: '#11111b',
    foreground: '#CDD6F4',
    cursor: '#89B4FA',
    selectionBackground: 'rgba(137, 180, 250, 0.3)',
    black: '#45475a',
    red: '#F38BA8',
    green: '#A6E3A1',
    yellow: '#F9E2AF',
    blue: '#89B4FA',
    magenta: '#CBA6F7',
    cyan: '#94E2D5',
    white: '#BAC2DE',
  },
  light: {
    background: '#f3f4f6',
    foreground: '#1f2937',
    cursor: '#3b82f6',
    selectionBackground: 'rgba(59, 130, 246, 0.3)',
  },
}
