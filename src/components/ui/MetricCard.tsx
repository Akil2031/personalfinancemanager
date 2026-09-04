import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  theme,
} from '../../theme';

type MetricTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: string;
  tone?: MetricTone;
}

const tones = {
  blue: {
    background:
      theme.colors.primaryLight,
    icon:
      theme.colors.primary,
  },

  green: {
    background:
      theme.colors.successLight,
    icon:
      theme.colors.success,
  },

  orange: {
    background:
      theme.colors.warningLight,
    icon:
      theme.colors.warning,
  },

  purple: {
    background:
      theme.colors.purpleLight,
    icon:
      theme.colors.purple,
  },

  red: {
    background:
      theme.colors.dangerLight,
    icon:
      theme.colors.danger,
  },
};

export default function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
}: MetricCardProps) {
  const current =
    tones[tone];

  return (
    <View
      style={styles.card}
    >
      {icon && (
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor:
                current.background,
            },
          ]}
        >
          <Text
            style={[
              styles.icon,
              {
                color:
                  current.icon,
              },
            ]}
          >
            {icon}
          </Text>
        </View>
      )}

      <Text
        style={styles.label}
      >
        {label}
      </Text>

      <Text
        style={styles.value}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>

      {detail && (
        <Text
          style={styles.detail}
        >
          {detail}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 145,
    flex: 1,

    padding:
      theme.spacing.xl,

    borderRadius:
      theme.radius.xl,

    backgroundColor:
      theme.colors.surfaceGlass,

    borderWidth: 1,
    borderColor:
      theme.colors.border,

    ...theme.shadows.soft,
  },

  iconBox: {
    width: 36,
    height: 36,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 13,
  },

  icon: {
    fontSize: 19,
    fontWeight: '900',
  },

  label: {
    ...theme.typography.label,
    color:
      theme.colors.textSecondary,
  },

  value: {
    ...theme.typography.metricLarge,
    color:
      theme.colors.text,

    marginTop: 3,
  },

  detail: {
    ...theme.typography.tiny,
    color:
      theme.colors.textMuted,

    marginTop: 4,
  },
});
