import React, { useState } from 'react';

import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePathname, useRouter } from 'expo-router';

import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';

type IconName =
  | 'dashboard'
  | 'loans'
  | 'calculator'
  | 'payments'
  | 'insights'
  | 'search'
  | 'notifications'
  | 'chevron';

type NavigationItem = {
  label: string;
  route: string;
  icon: IconName;
};

const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', route: '/', icon: 'grid-outline' },
  { label: 'Loans', route: '/loans', icon: 'layers-outline' },
  { label: 'Calculator', route: '/calculator', icon: 'calculator-outline' },
  { label: 'Payments', route: '/payments', icon: 'swap-horizontal-outline' },
  { label: 'Insights', route: '/insights', icon: 'sparkles-outline' },
];

function isRouteActive(pathname: string, route: string) {
  if (route === '/') {
    return pathname === '/' || pathname === '/index';
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

function AppIcon({
  name,
  size = 16,
  color = '#64748B',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const stroke = Math.max(1.4, size / 9);

  if (name === 'dashboard') {
    return (
      <View style={[styles.iconCanvas, { width: size, height: size }]}>
        <View style={[styles.dashboardCell, { borderColor: color }]} />
        <View style={[styles.dashboardCell, { borderColor: color }]} />
        <View style={[styles.dashboardCell, { borderColor: color }]} />
        <View style={[styles.dashboardCell, { borderColor: color }]} />
      </View>
    );
  }

  if (name === 'loans') {
    return (
      <View style={[styles.iconCanvas, { width: size + 2, height: size }]}>
        <View style={[styles.loanLine, { borderColor: color, top: 2 }]} />
        <View style={[styles.loanLine, { borderColor: color, top: 5 }]} />
        <View style={[styles.loanLine, { borderColor: color, top: 8 }]} />
      </View>
    );
  }

  if (name === 'calculator') {
    return (
      <View
        style={[
          styles.calculatorIcon,
          {
            width: size * 0.78,
            height: size,
            borderColor: color,
            borderRadius: 3,
          },
        ]}
      >
        <View style={[styles.calculatorDisplay, { backgroundColor: color }]} />
        <View style={styles.calculatorGrid}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.calculatorDot,
                { backgroundColor: color },
              ]}
            />
          ))}
        </View>
      </View>
    );
  }

  if (name === 'payments') {
    return (
      <View style={[styles.paymentIcon, { width: size + 2, height: size }]}>
        <View style={[styles.paymentArrowLine, { backgroundColor: color }]} />
        <View
          style={[
            styles.paymentArrowHead,
            { borderColor: color, borderLeftWidth: stroke, borderBottomWidth: stroke },
          ]}
        />
        <View style={[styles.paymentArrowLine2, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'insights') {
    return (
      <View style={[styles.sparkle, { width: size, height: size }]}>
        <View style={[styles.sparkleV, { backgroundColor: color }]} />
        <View style={[styles.sparkleH, { backgroundColor: color }]} />
        <View style={[styles.sparkleSmall, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'search') {
    return (
      <View style={[styles.searchGlyph, { width: size, height: size }]}>
        <View style={[styles.searchCircle, { borderColor: color }]} />
        <View style={[styles.searchHandle, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'notifications') {
    return (
      <View style={[styles.bell, { width: size, height: size }]}>
        <View style={[styles.bellBody, { borderColor: color }]} />
        <View style={[styles.bellClapper, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View style={styles.chevron}>
      <View style={[styles.chevronLineA, { backgroundColor: color }]} />
      <View style={[styles.chevronLineB, { backgroundColor: color }]} />
    </View>
  );
}

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigate = (route: string) => {
    setProfileOpen(false);
    router.push(route as any);
  };

  async function handleLogout() {
    if (loggingOut) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (!confirmed) return;
      await performLogout();
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ],
    );
  }

  async function performLogout() {
    try {
      setLoggingOut(true);
      setProfileOpen(false);
      await logout();
      // AuthGate handles the redirect to /login.
    } catch (error) {
      console.error('Logout failed:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to logout. Please try again.';

      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Logout Failed', message);
      }
    } finally {
      setLoggingOut(false);
    }
  }

  const userEmail = user?.email || 'Signed in';
  const initials =
    user?.email?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <View style={styles.header}>
      <View style={styles.headerInner}>
        {/* Brand */}
        <Pressable
          onPress={() => navigate('/')}
          style={({ pressed }) => [
            styles.brand,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Finance dashboard"
        >
          <View style={styles.brandMark}>
            <View style={styles.brandMarkGlow} />
            <Text style={styles.brandMarkText}>â‚¹</Text>
          </View>

          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>Finance</Text>
            <Text style={styles.brandSubtitle}>PERSONAL MANAGER</Text>
          </View>
        </Pressable>

        {/* Desktop navigation */}
        <View style={styles.navigation}>
          {navigationItems.map((item) => {
            const active = isRouteActive(pathname, item.route);

            return (
              <Pressable
                key={item.route}
                onPress={() => navigate(item.route)}
                style={({ pressed }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <AppIcon
                  name={item.icon}
                  size={16}
                  color={
                    active
                      ? theme.colors.primary
                      : theme.colors.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                  ]}
                >
                  {item.label}
                </Text>

                {active && <View style={styles.activeDot} />}
              </Pressable>
            );
          })}
        </View>

        {/* Search + actions */}
        <View style={styles.rightArea}>
          {Platform.OS === 'web' && (
            <View style={styles.search}>
              <AppIcon name="search" size={15} color={theme.colors.textMuted} />
              <TextInput
                placeholder="Search"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.searchInput}
                outlineStyle="none"
                accessibilityLabel="Search"
              />
              <View style={styles.searchShortcut}>
                <Text style={styles.searchShortcutText}>âŒ˜ K</Text>
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.iconButtonPressed,
            ]}
            accessibilityLabel="Notifications"
          >
            <AppIcon name="notifications" size={17} color={theme.colors.textSecondary} />
            <View style={styles.notificationDot} />
          </Pressable>

          <View style={styles.verticalDivider} />

          <View style={styles.profileWrapper}>
            <Pressable
              onPress={() => setProfileOpen((value) => !value)}
              style={({ pressed }) => [
                styles.profileButton,
                profileOpen && styles.profileButtonActive,
                pressed && styles.iconButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open account menu"
              accessibilityState={{ expanded: profileOpen }}
            >
              <Text style={styles.profileInitial}>{initials}</Text>
              <AppIcon name="chevron" size={10} color={theme.colors.textSecondary} />
            </Pressable>

            {profileOpen && (
              <View style={styles.profileMenu}>
                <View style={styles.profileMenuHeader}>
                  <View style={styles.menuAvatar}>
                    <Text style={styles.menuAvatarText}>{initials}</Text>
                  </View>

                  <View style={styles.menuIdentity}>
                    <Text style={styles.menuName}>My Account</Text>
                    <Text
                      numberOfLines={1}
                      style={styles.menuEmail}
                    >
                      {userEmail}
                    </Text>
                  </View>
                </View>

                <View style={styles.menuDivider} />

                <Pressable
                  disabled={loggingOut}
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.logoutButton,
                    pressed && styles.logoutPressed,
                    loggingOut && styles.logoutDisabled,
                  ]}
                >
                  <AppIcon name="payments" size={16} color="#D14B5B" />
                  <Text style={styles.logoutText}>
                    {loggingOut ? 'Logging outâ€¦' : 'Logout'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    height: 72,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    zIndex: 1000,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        } as any)
      : {}),
  },

  headerInner: {
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    height: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },

  brand: {
    width: 188,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },

  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...theme.shadows.soft,
  },

  brandMarkGlow: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    right: -9,
    top: -8,
    backgroundColor: theme.colors.primary,
    opacity: 0.35,
  },

  brandMarkText: {
    color: theme.colors.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    zIndex: 1,
  },

  brandCopy: {
    marginLeft: 10,
    justifyContent: 'center',
  },

  brandName: {
    color: theme.colors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    lineHeight: 19,
    letterSpacing: -0.25,
  },

  brandSubtitle: {
    marginTop: 1,
    color: theme.colors.textMuted,
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    lineHeight: 9,
    letterSpacing: 1.05,
  },

  navigation: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },

  navItem: {
    height: 42,
    paddingHorizontal: 13,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    position: 'relative',
  },

  navItemActive: {
    backgroundColor: theme.colors.primaryLight,
  },

  navItemPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.985 }],
  },

  navLabel: {
    color: theme.colors.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 16,
  },

  navLabelActive: {
    color: theme.colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },

  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },

  rightArea: {
    width: 300,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 9,
    flexShrink: 0,
  },

  search: {
    width: 150,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchInput: {
    flex: 1,
    height: '100%',
    marginLeft: 7,
    paddingVertical: 0,
    paddingHorizontal: 0,
    color: theme.colors.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  } as any,

  searchShortcut: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  searchShortcutText: {
    color: theme.colors.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
  },

  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  iconButtonPressed: {
    opacity: 0.62,
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },

  verticalDivider: {
    width: 1,
    height: 26,
    backgroundColor: theme.colors.border,
    marginHorizontal: 2,
  },

  profileWrapper: {
    position: 'relative',
    zIndex: 9999,
  },

  profileButton: {
    height: 38,
    minWidth: 64,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  profileButtonActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: 'rgba(53,109,255,0.20)',
  },

  profileInitial: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    overflow: 'hidden',
  },

  profileMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 265,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.medium,
    zIndex: 10000,
  },

  profileMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
  },

  menuAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  menuAvatarText: {
    color: theme.colors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },

  menuIdentity: {
    flex: 1,
    marginLeft: 10,
  },

  menuName: {
    color: theme.colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },

  menuEmail: {
    marginTop: 3,
    color: theme.colors.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },

  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 11,
  },

  logoutButton: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFF4F5',
  },

  logoutPressed: {
    opacity: 0.68,
  },

  logoutDisabled: {
    opacity: 0.45,
  },

  logoutText: {
    color: '#D14B5B',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },


  iconCanvas: {
    position: 'relative',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 1,
  },

  dashboardCell: {
    width: 5,
    height: 5,
    borderWidth: 1.4,
    borderRadius: 1.5,
  },

  loanLine: {
    position: 'absolute',
    left: 1,
    right: 1,
    height: 7,
    borderWidth: 1.2,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },

  calculatorIcon: {
    borderWidth: 1.4,
    padding: 2,
  },

  calculatorDisplay: {
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },

  calculatorGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    gap: 2,
    paddingTop: 2,
  },

  calculatorDot: {
    width: 3,
    height: 3,
    borderRadius: 1,
    opacity: 0.85,
  },

  paymentIcon: {
    position: 'relative',
    justifyContent: 'center',
  },

  paymentArrowLine: {
    position: 'absolute',
    left: 1,
    top: 4,
    width: 9,
    height: 1.5,
    borderRadius: 1,
  },

  paymentArrowHead: {
    position: 'absolute',
    right: 1,
    top: 2,
    width: 5,
    height: 5,
    transform: [{ rotate: '225deg' }],
  },

  paymentArrowLine2: {
    position: 'absolute',
    left: 4,
    bottom: 3,
    width: 8,
    height: 1.5,
    borderRadius: 1,
    opacity: 0.55,
  },

  sparkle: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sparkleV: {
    position: 'absolute',
    width: 2,
    height: 13,
    borderRadius: 1,
  },

  sparkleH: {
    position: 'absolute',
    width: 13,
    height: 2,
    borderRadius: 1,
  },

  sparkleSmall: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    right: 0,
    top: 0,
    opacity: 0.75,
  },

  searchGlyph: {
    position: 'relative',
  },

  searchCircle: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 9,
    height: 9,
    borderWidth: 1.5,
    borderRadius: 5,
  },

  searchHandle: {
    position: 'absolute',
    width: 6,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
    left: 9,
    top: 10,
  },

  bell: {
    position: 'relative',
  },

  bellBody: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 11,
    height: 11,
    borderWidth: 1.4,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },

  bellClapper: {
    position: 'absolute',
    left: 7,
    bottom: 1,
    width: 4,
    height: 2,
    borderRadius: 2,
  },

  chevron: {
    width: 10,
    height: 8,
    position: 'relative',
  },

  chevronLineA: {
    position: 'absolute',
    width: 6,
    height: 1.3,
    left: 1,
    top: 3,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },

  chevronLineB: {
    position: 'absolute',
    width: 6,
    height: 1.3,
    right: 1,
    top: 3,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },

  pressed: {
    opacity: 0.72,
  },
});

