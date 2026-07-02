export const designTokens = {
  locale: {
    supported: ['th', 'ko'] as const,
    default: 'th' as const,
  },
  color: {
    brand: {
      coral: '#e9524f',
      ink: '#332b5f',
      mint: '#60cdb8',
      honey: '#e7b846',
      blush: '#fff1ef',
      lilac: '#f1edff',
    },
    light: {
      background: '#fffaf2',
      foreground: '#292237',
      card: '#ffffff',
      muted: '#f1eff4',
      mutedForeground: '#7a7184',
      border: '#ecd9d5',
      primary: '#e9524f',
      primaryForeground: '#ffffff',
      secondary: '#f1edff',
      secondaryForeground: '#332b5f',
      accent: '#e5fbf6',
      accentForeground: '#235d52',
      destructive: '#d83f32',
    },
    dark: {
      background: '#211c2f',
      foreground: '#fbf7ef',
      card: '#2c263b',
      muted: '#3a3349',
      mutedForeground: '#c6bdcf',
      border: 'rgba(255, 255, 255, 0.12)',
      primary: '#f06a63',
      primaryForeground: '#ffffff',
      secondary: '#443a59',
      secondaryForeground: '#f1edff',
      accent: '#245f55',
      accentForeground: '#dffaf4',
      destructive: '#ff6b5d',
    },
  },
  radius: {
    sm: 7,
    md: 10,
    lg: 12,
    xl: 16,
    xxl: 20,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  typography: {
    families: {
      body: ['Noto Sans Thai', 'Noto Sans KR', 'system-ui', 'sans-serif'],
      display: ['Noto Sans Thai', 'Noto Sans KR', 'system-ui', 'sans-serif'],
    },
    weight: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      black: '900',
    },
    size: {
      caption: 11,
      body: 15,
      bodyLarge: 17,
      title: 22,
      hero: 42,
    },
  },
  layout: {
    mobileMaxWidth: 448,
    bottomNavHeight: 80,
    screenPadding: 16,
  },
} as const;

export type SupportedLocale = typeof designTokens.locale.supported[number];
export type AppThemeMode = 'light' | 'dark';

export function getThemeColors(mode: AppThemeMode = 'light') {
  return designTokens.color[mode];
}
