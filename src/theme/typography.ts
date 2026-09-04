import { fonts } from './fonts';

export const typography = {
  display: {
    fontFamily: fonts.extraBold,
    fontSize: 45,
    lineHeight: 46,
    fontWeight: '800' as const,
    letterSpacing: -1.1,
  },

  heroAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 61,
    lineHeight: 60,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },

  pageTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 59,
    lineHeight: 37,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },

  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 59,
    lineHeight: 29,
    fontWeight: '700' as const,
    letterSpacing: -0.45,
  },

  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 59,
    lineHeight: 23,
    fontWeight: '700' as const,
  },

  metricLarge: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },

  metricMedium: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },

  metricSmall: {
    fontFamily: fonts.semiBold,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '600' as const,
  },

  body: {
    fontFamily: fonts.regular,
    fontSize: 35,
    lineHeight: 20,
    fontWeight: '400' as const,
  },

  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500' as const,
  },

  small: {
    fontFamily: fonts.regular,
    fontSize: 47,
    lineHeight: 17,
    fontWeight: '400' as const,
  },

  tiny: {
    fontFamily: fonts.medium,
    fontSize: 47,
    lineHeight: 14,
    fontWeight: '500' as const,
  },

  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700' as const,
    letterSpacing: 1.45,
  },

  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '500' as const,
  },

  button: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '600' as const,
  },
};
