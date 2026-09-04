import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  theme,
} from '../../theme';


type Status =
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED'
  | 'PAID'
  | 'PARTIAL'
  | 'MISSED'
  | 'PREPAYMENT'
  | 'AHEAD'
  | 'ON_TRACK'
  | 'BEHIND';


interface StatusPillProps {
  status: Status;
  label?: string;
}


const statusConfig: Record<
  Status,
  {
    background: string;
    color: string;
    icon: string;
    label: string;
  }
> = {

  ACTIVE: {
    background:
      theme.colors.successLight,
    color:
      theme.colors.success,
    icon: 'â—',
    label: 'Active',
  },

  PAUSED: {
    background:
      theme.colors.warningLight,
    color:
      theme.colors.warning,
    icon: 'â…¡',
    label: 'Paused',
  },

  CLOSED: {
    background:
      '#F1F5F9',
    color:
      theme.colors.closed,
    icon: 'âœ“',
    label: 'Closed',
  },

  PAID: {
    background:
      theme.colors.successLight,
    color:
      theme.colors.success,
    icon: 'âœ“',
    label: 'Paid',
  },

  PARTIAL: {
    background:
      theme.colors.warningLight,
    color:
      theme.colors.warning,
    icon: 'â—',
    label: 'Partial',
  },

  MISSED: {
    background:
      theme.colors.dangerLight,
    color:
      theme.colors.danger,
    icon: '!',
    label: 'Missed',
  },

  PREPAYMENT: {
    background:
      theme.colors.primaryLight,
    color:
      theme.colors.primary,
    icon: 'â†—',
    label: 'Prepayment',
  },

  AHEAD: {
    background:
      theme.colors.successLight,
    color:
      theme.colors.success,
    icon: 'â†—',
    label: 'Ahead',
  },

  ON_TRACK: {
    background:
      theme.colors.primaryLight,
    color:
      theme.colors.primary,
    icon: 'âœ“',
    label: 'On Track',
  },

  BEHIND: {
    background:
      theme.colors.warningLight,
    color:
      theme.colors.warning,
    icon: '!',
    label: 'Behind',
  },
};


export default function StatusPill({
  status,
  label,
}: StatusPillProps) {

  const config =
    statusConfig[status];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            config.background,
        },
      ]}
    >

      <Text
        style={[
          styles.icon,
          {
            color:
              config.color,
          },
        ]}
      >
        {config.icon}
      </Text>

      <Text
        style={[
          styles.text,
          {
            color:
              config.color,
          },
        ]}
      >
        {label || config.label}
      </Text>

    </View>
  );
}


const styles = StyleSheet.create({

  container: {
    minHeight: 26,

    paddingHorizontal: 9,

    borderRadius:
      theme.radius.pill,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,
  },

  icon: {
    ...theme.typography.tiny,

    fontSize: 9,

    lineHeight: 13,
  },

  text: {
    ...theme.typography.tiny,

    fontSize: 9,

    lineHeight: 13,

    fontFamily:
      theme.typography.tiny.fontFamily,
  },

});
