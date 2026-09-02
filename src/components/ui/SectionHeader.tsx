import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  theme,
} from '../../theme';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}

export default function SectionHeader({
  eyebrow,
  title,
  description,
  right,
}: SectionHeaderProps) {
  return (
    <View
      style={styles.container}
    >
      <View
        style={styles.content}
      >
        {eyebrow && (
          <Text
            style={styles.eyebrow}
          >
            {eyebrow}
          </Text>
        )}

        <Text
          style={styles.title}
        >
          {title}
        </Text>

        {description && (
          <Text
            style={styles.description}
          >
            {description}
          </Text>
        )}
      </View>

      {right && (
        <View>
          {right}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 55,

    marginBottom:
      theme.spacing.lg,

    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent:
      'space-between',

    gap: theme.spacing.lg,
  },

  content: {
    flex: 1,
  },

  eyebrow: {
    ...theme.typography.eyebrow,
    color:
      theme.colors.primary,
    marginBottom: 4,
  },

  title: {
    ...theme.typography.sectionTitle,
    color:
      theme.colors.text,
  },

  description: {
    ...theme.typography.small,
    color:
      theme.colors.textSecondary,
    marginTop: 4,
  },
});