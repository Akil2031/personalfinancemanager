import React, { useState } from 'react';

import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  usePathname,
  useRouter,
} from 'expo-router';

import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';

interface NavigationItem {
  label: string;
  shortLabel: string;
  icon: string;
  route: string;
}

interface AppShellProps {
  children: React.ReactNode;
}

const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', icon: '⌂', route: '/' },
  { label: 'Loans', shortLabel: 'Loans', icon: '◈', route: '/loans' },
  { label: 'Calculator', shortLabel: 'Calc', icon: '＋', route: '/calculator' },
 
  { label: 'Insights', shortLabel: 'Insights', icon: '✦', route: '/insights' },
];

function isRouteActive(pathname: string, route: string) {
  if (route === '/') {
    return pathname === '/' || pathname === '/index';
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

function DesktopNavItem({
  item,
  active,
  compact,
  onPress,
}: {
  item: NavigationItem;
  active: boolean;
  compact: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        compact && styles.navItemCompact,
        active && styles.navItemActive,
        pressed && styles.navItemPressed,
      ]}
    >
      {/* Keep icons for tablet/compact navigation; desktop uses text-only navigation. */}
      {compact && (
        <View style={[styles.navIconBox, active && styles.navIconBoxActive]}>
          <Text style={[styles.navIcon, active && styles.navIconActive]}>
            {item.icon}
          </Text>
        </View>
      )}

      <Text style={[styles.navLabel, active && styles.navLabelActive]}>
        {compact ? item.shortLabel : item.label}
      </Text>
    </Pressable>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isDesktop = width >= 1050;
  const isMobile = width < 700;
  const isLogin = pathname === '/login';

  async function performLogout() {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      setProfileOpen(false);
      await logout();
    } catch (error) {
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

  async function handleLogout() {
    if (loggingOut) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to logout?',
      );

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
          onPress: () => void performLogout(),
        },
      ],
    );
  }

  if (isLogin) {
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
                  pressed && styles.navItemPressed,
                ]}
              >
                <View
                  style={[
                    styles.mobileNavIconBox,
                    active && styles.mobileNavIconBoxActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.mobileNavIcon,
                      active && styles.mobileNavIconActive,
                    ]}
                  >
                    {item.icon}
                  </Text>
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
      <View style={styles.headerOuter}>
        <View style={styles.header}>
          {/* BRAND — preserved as the main application header */}
          <Pressable
            onPress={() => router.push('/' as any)}
            style={({ pressed }) => [
              styles.brand,
              pressed && styles.brandPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Personal Finance Manager home"
          >
            <View style={styles.logoFrame}>
              <Image
                source={require('../../assets/finance-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.brandTextContainer}>
              <Text style={styles.brandName} numberOfLines={1}>
                Personal Finance Manager
              </Text>
              <Text style={styles.brandSubtitle} numberOfLines={1}>
                Plan Smart. Save More. Live Better.
              </Text>
            </View>
          </Pressable>

          {/* NAVIGATION */}
          <View
            style={[
              styles.navigation,
              !isDesktop && styles.navigationTablet,
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.navigationContent}
            >
              {navigationItems.map((item) => (
                <DesktopNavItem
                  key={item.route}
                  item={item}
                  active={isRouteActive(pathname, item.route)}
                  compact={!isDesktop}
                  onPress={() => {
                    setProfileOpen(false);
                    router.push(item.route as any);
                  }}
                />
              ))}
            </ScrollView>
          </View>

          {/* RIGHT SIDE */}
          {isDesktop && (
            <View style={styles.headerRight}>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  placeholder="Search"
                  placeholderTextColor="#8A97AB"
                  style={styles.searchInput}
                  editable
                  returnKeyType="search"
                  accessibilityLabel="Search"
                />
                <View style={styles.searchShortcut}>
                  <Text style={styles.searchShortcutText}>⌘ K</Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.headerAction,
                  pressed && styles.headerActionPressed,
                ]}
                accessibilityLabel="Notifications"
              >
                <Text style={styles.headerActionIcon}>♧</Text>
                <View style={styles.notificationDot} />
              </Pressable>

              <View style={styles.profileWrapper}>
                <Pressable
                  onPress={() => setProfileOpen((value) => !value)}
                  style={[
                    styles.profileButton,
                    profileOpen && styles.profileButtonActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Account menu"
                >
                  <Text style={styles.profileLetter}>
                    {(user?.displayName?.trim()?.charAt(0) || user?.email?.charAt(0) || 'A').toUpperCase()}
                  </Text>
                  <Text style={styles.profileChevron}>⌄</Text>
                </Pressable>

                {profileOpen && (
                  <View style={styles.profileMenu}>
                    <Text style={styles.profileMenuTitle}>Account</Text>
                    <Text numberOfLines={1} style={styles.profileEmail}>
                      {user?.email || 'Signed in'}
                    </Text>

                    <View style={styles.profileDivider} />

                    <Pressable
                      disabled={loggingOut}
                      onPress={() => void handleLogout()}
                      style={({ pressed }) => [
                        styles.logoutButton,
                        pressed && styles.logoutButtonPressed,
                        loggingOut && styles.logoutButtonDisabled,
                      ]}
                    >
                      <Text style={styles.logoutIcon}>↪</Text>
                      <Text style={styles.logoutText}>
                        {loggingOut ? 'Logging out...' : 'Logout'}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          )}

          {!isDesktop && (
            <View style={styles.compactActions}>
              <Pressable style={styles.headerAction} accessibilityLabel="Notifications">
                <Text style={styles.headerActionIcon}>♧</Text>
                <View style={styles.notificationDot} />
              </Pressable>

              <Pressable
                onPress={() => setProfileOpen((value) => !value)}
                style={styles.profileButtonCompact}
                accessibilityRole="button"
                accessibilityLabel="Account menu"
              >
                <Text style={styles.profileLetter}>
                  {(user?.displayName?.trim()?.charAt(0) || user?.email?.charAt(0) || 'A').toUpperCase()}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

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
    width: '100%',
  },

  loginShell: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  headerOuter: {
    width: '100%',
    height: 76,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: '#E4EAF2',
    position: 'relative',
    zIndex: 1000,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        } as any)
      : {}),
  },

  header: {
    width: '100%',
    height: 76,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },

  brand: {
    width: 300,
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 12,
  },

  brandPressed: {
    opacity: 0.78,
  },

  logoFrame: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  logoImage: {
    width: 46,
    height: 46,
  },

  brandTextContainer: {
    justifyContent: 'center',
  },

  brandName: {
    color: '#14213D',
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.3,
  },

  brandSubtitle: {
    marginTop: 3,
    color: '#8A97AB',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.05,
  },

  navigation: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    justifyContent: 'center',
  },

  navigationTablet: {
    justifyContent: 'flex-start',
  },

  navigationContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },

  navItem: {
    height: 44,
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  navItemCompact: {
    minWidth: 68,
    paddingHorizontal: 7,
    gap: 6,
  },

  navItemActive: {
    backgroundColor: '#EEF3FF',
  },

  navItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  navIconBox: {
    width: 25,
    height: 25,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconBoxActive: {
    backgroundColor: '#FFFFFF',
  },

  navIcon: {
    fontSize: 14,
    lineHeight: 18,
    color: '#7C899D',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  navIconActive: {
    color: '#356DFF',
  },

  navLabel: {
    color: '#58677D',
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },

  navLabelActive: {
    color: '#356DFF',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  headerRight: {
    width: 340,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 9,
    flexShrink: 0,
  },

  searchBox: {
    width: 168,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFE6F0',
    backgroundColor: '#F7F9FC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 11,
    paddingRight: 7,
  },

  searchIcon: {
    width: 22,
    textAlign: 'center',
    color: '#7E8DA4',
    fontSize: 19,
    fontFamily: 'Inter_500Medium',
  },

  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 4,
    color: '#1A2942',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    outlineStyle: 'none',
  } as any,

  searchShortcut: {
    paddingHorizontal: 5,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },

  searchShortcutText: {
    color: '#9AA6B8',
    fontSize: 8,
    fontFamily: 'Inter_600SemiBold',
  },

  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFE6F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerActionPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },

  headerActionIcon: {
    color: '#66758B',
    fontSize: 17,
    fontWeight: '700',
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#356DFF',
  },

  profileWrapper: {
    position: 'relative',
    zIndex: 9999,
  },

  profileButton: {
    height: 40,
    minWidth: 62,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#DFE6F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  profileButtonActive: {
    backgroundColor: '#EEF3FF',
    borderColor: '#C9D7FF',
  },

  profileLetter: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor: '#356DFF',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 25,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
  },

  profileChevron: {
    color: '#738198',
    fontSize: 13,
    marginTop: -3,
  },

  profileMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 250,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 15,
    shadowColor: '#15213A',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 20,
    zIndex: 99999,
  },

  profileMenuTitle: {
    color: '#17243D',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
  },

  profileEmail: {
    marginTop: 5,
    color: '#7D8A9F',
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
  },

  profileDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: '#EDF0F5',
  },

  logoutButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
  },

  logoutButtonPressed: {
    opacity: 0.7,
  },

  logoutButtonDisabled: {
    opacity: 0.5,
  },

  logoutIcon: {
    marginRight: 9,
    fontSize: 17,
    color: '#C62828',
  },

  logoutText: {
    color: '#C62828',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },

  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 0,
  },

  profileButtonCompact: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#356DFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileShell: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  mobileContent: {
    flex: 1,
    paddingBottom: 76,
  },

  mobileBottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#64748B',
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
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

  mobileNavIconBox: {
    width: 32,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileNavIconBoxActive: {
    backgroundColor: '#EEF3FF',
  },

  mobileNavIcon: {
    fontSize: 16,
    color: '#7C899D',
  },

  mobileNavIconActive: {
    color: '#356DFF',
  },

  mobileNavLabel: {
    fontSize: 8,
    lineHeight: 12,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#7C899D',
  },

  mobileNavLabelActive: {
    color: '#356DFF',
  },
});