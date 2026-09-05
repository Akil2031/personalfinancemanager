// Personal Finance Manager — Yellow Creative FinTech Theme
export const theme = {
  colors: {
    primary: '#F4C400', primaryDark: '#171A24', primarySoft: '#FFF4B8',
    secondary: '#FF7A00', secondarySoft: '#FFE3C7',
    cyan: '#00A6A6', cyanSoft: '#DDF7F5', magenta: '#E83E8C', magentaSoft: '#F9DCEB',
    background: '#FFD83D', surface: '#FFFFFF', surfaceSoft: '#FFF7D6',
    text: '#171A24', textSecondary: '#4A3A12', textMuted: '#6B5A1A', textOnPrimary: '#171A24',
    border: '#E7C33A', borderStrong: '#D5AA00',
    success: '#18ce08', successSoft: '#E2F6EC', warning: '#F28C00', warningSoft: '#FFF0D4',
    danger: '#D93636', dangerSoft: '#FCE4E4', accentGold: '#FFD43B',
    overlay: 'rgba(23,26,36,0.08)', shadow: 'rgba(23,26,36,0.18)',
  },
  typography: { fontFamily: 'Inter', title: '#171A24', body: '#171A24', secondary: '#4D5566', muted: '#7D8492' },
  radius: { sm: 10, md: 14, lg: 18, xl: 24 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
};
export type AppTheme = typeof theme;
