import { fonts } from './fonts';

export const typography = {
  display: {
    fontFamily: fonts.extraBold,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '800' as const,
    letterSpacing: -1.1,
  },

  heroAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 52,
    lineHeight: 60,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },

  pageTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 50,
    lineHeight: 37,
    fontWeight: '800' as const,
    letterSpacing: -0.8,
  },

  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 50,
    lineHeight: 29,
    fontWeight: '700' as const,
    letterSpacing: -0.45,
  },

  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 50,
    lineHeight: 23,
    fontWeight: '700' as const,
  },

  metricLarge: {
    fontFamily: fonts.bold,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.6,
  },

  metricMedium: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },

  metricSmall: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600' as const,
  },

  body: {
    fontFamily: fonts.regular,
    fontSize: 30,
    lineHeight: 20,
    fontWeight: '400' as const,
  },

  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500' as const,
  },

  small: {
    fontFamily: fonts.regular,
    fontSize: 40,
    lineHeight: 17,
    fontWeight: '400' as const,
  },

  tiny: {
    fontFamily: fonts.medium,
    fontSize: 40,
    lineHeight: 14,
    fontWeight: '500' as const,
  },

  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700' as const,
    letterSpacing: 1.45,
  },

  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500' as const,
  },

  button: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600' as const,
  },
};