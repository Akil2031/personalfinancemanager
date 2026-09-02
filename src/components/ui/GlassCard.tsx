import React from 'react';

import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import {
  theme,
} from '../../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export default function GlassCard({
  children,
  style,
  padding = theme.spacing.xxl,
}: GlassCardProps) {
  const webStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter:
            'blur(18px)',
          WebkitBackdropFilter:
            'blur(18px)',
        } as any)
      : null;

  return (
    <View
      style={[
        styles.card,
        {
          padding,
        },
        webStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius:
      theme.radius.xxl,

    backgroundColor:
      theme.colors.surfaceGlass,

    borderWidth: 1,
    borderColor:
      theme.colors.border,

    ...theme.shadows.soft,
  },
});