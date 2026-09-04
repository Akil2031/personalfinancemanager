import React from 'react';

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  theme,
} from '../../theme';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
}

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: AppButtonProps) {
  const variantStyles = {
    primary: {
      backgroundColor:
        theme.colors.primary,
      borderColor:
        theme.colors.primary,
      textColor:
        theme.colors.white,
    },

    secondary: {
      backgroundColor:
        theme.colors.primaryLight,
      borderColor:
        'transparent',
      textColor:
        theme.colors.primary,
    },

    ghost: {
      backgroundColor:
        'transparent',
      borderColor:
        theme.colors.border,
      textColor:
        theme.colors.text,
    },

    danger: {
      backgroundColor:
        theme.colors.dangerLight,
      borderColor:
        'transparent',
      textColor:
        theme.colors.danger,
    },
  };

  const current =
    variantStyles[variant];

  return (
    <Pressable
      disabled={
        disabled || loading
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor:
            current.backgroundColor,
          borderColor:
            current.borderColor,
        },

        (disabled || loading) &&
          styles.disabled,

        pressed &&
          !disabled &&
          styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={current.textColor}
        />
      ) : (
        <View
          style={styles.content}
        >
          {icon && (
            <Text
              style={[
                styles.icon,
                {
                  color:
                    current.textColor,
                },
              ]}
            >
              {icon}
            </Text>
          )}

          <Text
            style={[
              styles.text,
              {
                color:
                  current.textColor,
              },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    paddingHorizontal: 16,

    borderRadius:
      theme.radius.md,

    borderWidth: 1,

    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  text: {
    ...theme.typography.button,
  },

  icon: {
    fontSize: 19,
    fontWeight: '800',
  },

  pressed: {
    opacity: 0.78,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  disabled: {
    opacity: 0.45,
  },
});
