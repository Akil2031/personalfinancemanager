import {
  Platform,
} from 'react-native';

import {
  colors,
} from './colors';

import {
  typography,
} from './typography';

import {
  spacing,
  radius,
  layout,
} from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
  radius,
  layout,

  shadows: {
    soft: {
      shadowColor: '#64748B',
      shadowOpacity: 0.07,
      shadowRadius: 22,
      shadowOffset: {
        width: 0,
        height: 8,
      },
      elevation: 3,
    },

    medium: {
      shadowColor: '#475569',
      shadowOpacity: 0.10,
      shadowRadius: 28,
      shadowOffset: {
        width: 0,
        height: 12,
      },
      elevation: 5,
    },

    hero: {
      shadowColor: '#2855C9',
      shadowOpacity: 0.22,
      shadowRadius: 28,
      shadowOffset: {
        width: 0,
        height: 12,
      },
      elevation: 8,
    },
  },

  glass: {
    backgroundColor: colors.surfaceGlass,
    borderWidth: 1,
    borderColor: colors.border,

    ...(Platform.OS === 'web'
      ? ({
          backdropFilter:
            'blur(18px)',
          WebkitBackdropFilter:
            'blur(18px)',
        } as any)
      : {}),
  },
};