import React from 'react';

import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { usePathname, useRouter } from 'expo-router';

import AppHeader from './AppHeader';
import { theme } from '../theme';

type NavigationItem = {
  label: string;
  shortLabel: string;
  icon: IconName;
  route: string;
};

interface AppShellProps {
  children: React.ReactNode;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: 'grid-outline',
    route: '/',
  },
  {
    label: 'Loans',
    shortLabel: 'Loans',
    icon: 'layers-outline',
    route: '/loans',
  },
  {
    label: 'Calculator',
    shortLabel: 'Calc',
    icon: 'calculator-outline',
    route: '/calculator',
  },
  {
    label: 'Payments',
    shortLabel: 'Pay',
    icon: 'swap-horizontal-outline',
    route: '/payments',
  },
  {
    label: 'Insights',
    shortLabel: 'Insights',
    icon: 'sparkles-outline',
    route: '/insights',
  },
];

function isRouteActive(pathname: string, route: string) {
  if (route === '/') {
    return pathname === '/' || pathname === '/index';
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();

  const isMobile = width < 700;

  // Login should remain completely outside the application shell.
  if (pathname === '/login') {
    return (
      <View style={styles.loginShell}>
        {children}
      </View>
    );
  }

  if (isMobile) {
    return (
      <View style={styles.mobileShell}>
        <View style={styles.mobileContent}>{children}</View>

        <View style={styles.mobileBottomBar}>
          {navigationItems.map((item) => {
            const active = isRouteActive(pathname, item.route);

            return (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as any)}
                style={({ pressed }) => [
                  styles.mobileNavItem,
                  pressed && styles.mobilePressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View
                  style={[
                    styles.mobileIconBox,
                    active && styles.mobileIconBoxActive,
                  ]}
                >
                  <ShellIcon name={item.icon} active={active} />
                </View>

                <Text
                  style={[
                    styles.mobileNavLabel,
                    active && styles.mobileNavLabelActive,
                  ]}
                >
                  {item.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <AppHeader />

      <View style={styles.page}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  page: {
    flex: 1,
    minWidth: 0,
  },

  loginShell: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  mobileShell: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  mobileContent: {
    flex: 1,
    paddingBottom: 82,
  },

  mobileBottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    height: 66,
    paddingHorizontal: 5,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    ...theme.shadows.medium,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as any)
      : {}),
  },

  mobileNavItem: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  mobileIconBox: {
    width: 36,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileIconBoxActive: {
    backgroundColor: theme.colors.primaryLight,
  },

  mobileNavLabel: {
    color: theme.colors.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: 8,
    lineHeight: 12,
  },

  mobileNavLabelActive: {
    color: theme.colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },

  mobilePressed: {
    opacity: 0.62,
    transform: [{ scale: 0.97 }],
  },
});

