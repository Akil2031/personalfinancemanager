import React, { useState } from 'react';

import {
  Alert,
  Image,
  Platform,
  Pressable,
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

import {
  theme,
} from '../theme';

import {
  useAuth,
} from '../context/AuthContext';


/* ==========================================================================
   TYPES
   ========================================================================== */

interface NavigationItem {
  label: string;
  shortLabel: string;
  icon: string;
  route: string;
}

interface AppShellProps {
  children: React.ReactNode;
}


/* ==========================================================================
   NAVIGATION
   ========================================================================== */

const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: '⌂',
    route: '/',
  },
  {
    label: 'Loans',
    shortLabel: 'Loans',
    icon: '◈',
    route: '/loans',
  },
  {
    label: 'Calculator',
    shortLabel: 'Calc',
    icon: '＋',
    route: '/calculator',
  },
  {
    label: 'Insights',
    shortLabel: 'Insights',
    icon: '✦',
    route: '/insights',
  },
];


/* ==========================================================================
   ROUTE CHECK
   ========================================================================== */

function isRouteActive(
  pathname: string,
  route: string,
) {
  if (route === '/') {
    return (
      pathname === '/' ||
      pathname === '/index'
    );
  }

  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}


/* ==========================================================================
   NAV ITEM
   ========================================================================== */

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

        compact &&
          styles.navItemCompact,

        active &&
          styles.navItemActive,

        pressed &&
          styles.navItemPressed,
      ]}
    >
      <View
        style={[
          styles.navIconBox,
          active &&
            styles.navIconBoxActive,
        ]}
      >
        <Text
          style={[
            styles.navIcon,
            active &&
              styles.navIconActive,
          ]}
        >
          {item.icon}
        </Text>
      </View>

      {!compact && (
        <Text
          style={[
            styles.navLabel,
            active &&
              styles.navLabelActive,
          ]}
        >
          {item.label}
        </Text>
      )}
    </Pressable>
  );
}


/* ==========================================================================
   APP SHELL
   ========================================================================== */

export default function AppShell({
  children,
}: AppShellProps) {
  const router = useRouter();

  const pathname =
    usePathname();

  const {
    width,
  } = useWindowDimensions();

  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isDesktop =
    width >= 1050;

  const isMobile =
    width < 700;


  /* ------------------------------------------------------------------------
     IMPORTANT

     Login must NOT show the application navigation.
     ------------------------------------------------------------------------ */

  const isLogin =
    pathname === '/login';


  if (isLogin) {
    return (
      <View
        style={styles.loginShell}
      >
        {children}
      </View>
    );
  }


  const handleLogout = async () => {
    if (loggingOut) return;

    if (Platform.OS === 'web') {
      if (!window.confirm('Are you sure you want to logout?')) return;
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setLoggingOut(true);
                await logout();
              } finally {
                setLoggingOut(false);
              }
            })();
          },
        },
      ]);
      return;
    }

    try {
      setLoggingOut(true);
      setProfileOpen(false);
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  /* ------------------------------------------------------------------------
     MOBILE SHELL
     ------------------------------------------------------------------------ */

  if (isMobile) {
    return (
      <View
        style={styles.mobileShell}
      >
        <View style={styles.mobileHeader}>
          <Pressable
            onPress={() => router.push('/' as any)}
            style={styles.mobileBrand}
          >
            <View style={styles.mobileLogoFrame}>
              <Image
                source={require('../../assets/finance-logo.png')}
                style={styles.mobileLogoImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.mobileBrandName}>Finance</Text>
              <Text style={styles.mobileBrandSubtitle}>PERSONAL MANAGER</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            style={({ pressed }) => [
              styles.mobileLogoutButton,
              pressed && styles.logoutButtonPressed,
              loggingOut && styles.logoutButtonDisabled,
            ]}
          >
            <Text style={styles.mobileLogoutIcon}>↪</Text>
            <Text style={styles.mobileLogoutText}>
              {loggingOut ? 'Signing out…' : 'Logout'}
            </Text>
          </Pressable>
        </View>

        <View
          style={styles.mobileContent}
        >
          {children}
        </View>


        <View
          style={styles.mobileBottomBar}
        >
          {navigationItems.map(
            (item) => {
              const active =
                isRouteActive(
                  pathname,
                  item.route,
                );

              return (
                <Pressable
                  key={item.route}
                  onPress={() =>
                    router.push(
                      item.route as any,
                    )
                  }
                  style={({ pressed }) => [
                    styles.mobileNavItem,

                    pressed &&
                      styles.navItemPressed,
                  ]}
                >
                  <View
                    style={[
                      styles.mobileNavIconBox,

                      active &&
                        styles.mobileNavIconBoxActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.mobileNavIcon,

                        active &&
                          styles.mobileNavIconActive,
                      ]}
                    >
                      {item.icon}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.mobileNavLabel,

                      active &&
                        styles.mobileNavLabelActive,
                    ]}
                  >
                    {item.shortLabel}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
      </View>
    );
  }


  /* ------------------------------------------------------------------------
     DESKTOP / TABLET SHELL
     ------------------------------------------------------------------------ */

  return (
    <View
      style={styles.shell}
    >

      {/* ================================================================== */}
      {/* PREMIUM TOP HEADER                                                 */}
      {/* ================================================================== */}

      <View style={styles.headerOuter}>
        <View style={styles.header}>

          <Pressable
            onPress={() => router.push('/' as any)}
            style={({ pressed }) => [
              styles.brand,
              pressed && styles.brandPressed,
            ]}
          >
            <View style={styles.logoFrame}>
              <Image
                source={require('../../assets/finance-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.brandTextContainer}>
              <Text style={styles.brandName}>Finance</Text>
              <Text style={styles.brandSubtitle}>PERSONAL MANAGER</Text>
            </View>
          </Pressable>

          <View style={styles.navigation}>
            {navigationItems.map((item) => {
              const active = isRouteActive(pathname, item.route);

              return (
                <Pressable
                  key={item.route}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => [
                    styles.navItem,
                    !isDesktop && styles.navItemCompact,
                    active && styles.navItemActive,
                    pressed && styles.navItemPressed,
                  ]}
                >
                  <View style={[styles.navIconBox, active && styles.navIconBoxActive]}>
                    <Text style={[styles.navIcon, active && styles.navIconActive]}>
                      {item.icon}
                    </Text>
                  </View>
                  {isDesktop && (
                    <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.headerActions}>
            {isDesktop && (
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor="#7B8AA0"
                />
                <View style={styles.searchShortcut}>
                  <Text style={styles.searchShortcutText}>⌘ K</Text>
                </View>
              </View>
            )}

            <Pressable style={styles.headerAction} accessibilityLabel="Notifications">
              <Text style={styles.headerActionIcon}>♧</Text>
              <View style={styles.notificationDot} />
            </Pressable>

            <View style={styles.profileWrapper}>
              <Pressable
                style={[styles.profileButton, profileOpen && styles.profileButtonActive]}
                onPress={() => setProfileOpen((value) => !value)}
              >
                <Text style={styles.profileLetter}>A</Text>
                {isDesktop && <Text style={styles.profileChevron}>⌄</Text>}
              </Pressable>

              {profileOpen && (
                <View style={styles.profileMenu}>
                  <View style={styles.profileMenuHeader}>
                    <View style={styles.profileMenuAvatar}>
                      <Text style={styles.profileMenuAvatarText}>A</Text>
                    </View>
                    <View style={styles.profileMenuIdentity}>
                      <Text style={styles.profileMenuTitle}>My Account</Text>
                      <Text numberOfLines={1} style={styles.profileEmail}>
                        {user?.email || 'Signed in'}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    disabled={loggingOut}
                    style={({ pressed }) => [
                      styles.logoutButton,
                      pressed && styles.logoutButtonPressed,
                    ]}
                    onPress={handleLogout}
                  >
                    <Text style={styles.logoutIcon}>↪</Text>
                    <Text style={styles.logoutText}>{loggingOut ? 'Signing out…' : 'Logout'}</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleLogout}
              disabled={loggingOut}
              style={({ pressed }) => [
                styles.headerLogoutButton,
                pressed && styles.headerLogoutButtonPressed,
                loggingOut && styles.logoutButtonDisabled,
              ]}
            >
              <Text style={styles.headerLogoutIcon}>↪</Text>
              <Text style={styles.headerLogoutText}>
                {loggingOut ? 'Signing out…' : 'Logout'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ================================================================== */}
      {/* CONTENT                                                            */}
      {/* ================================================================== */}

      <View
        style={styles.page}
      >
        {children}
      </View>

    </View>
  );
}


/* ==========================================================================
   STYLES
   ========================================================================== */

const styles = StyleSheet.create({

  /* ---------------------------------------------------------------------- */
  /* SHELL                                                                  */
  /* ---------------------------------------------------------------------- */

  shell: {
    flex: 1,
    backgroundColor:
      theme.colors.background,
  },

  page: {
    flex: 1,
  },

  loginShell: {
    flex: 1,
    backgroundColor:
      theme.colors.background,
  },


  /* ---------------------------------------------------------------------- */
  /* HEADER                                                                 */
  /* ---------------------------------------------------------------------- */

  headerOuter: {
    width: '100%',
    minHeight: 72,

    backgroundColor:
      'rgba(255,255,255,0.88)',

    borderBottomWidth: 1,
    borderBottomColor:
      theme.colors.border,

    ...(Platform.OS === 'web'
      ? ({
          backdropFilter:
            'blur(20px)',
          WebkitBackdropFilter:
            'blur(20px)',
        } as any)
      : {}),
  },

  header: {
    width: '100%',
    maxWidth: theme.layout.maxContentWidth,
    minHeight: 76,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },


  /* ---------------------------------------------------------------------- */
  /* BRAND                                                                  */
  /* ---------------------------------------------------------------------- */

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 205,
    gap: 10,
  },

  brandPressed: {
    opacity: 0.78,
  },

  logoFrame: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadows.soft,
  },

  logoImage: {
    width: 44,
    height: 44,
  },

  brandTextContainer: {
    justifyContent: 'center',
  },

  brandName: {
    color: theme.colors.text,
    fontSize: 21,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
  },

  brandSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },

  /* ---------------------------------------------------------------------- */
  /* NAVIGATION                                                             */
  /* ---------------------------------------------------------------------- */

  navigation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  navigationTablet: {
    justifyContent: 'flex-start',
  },

  navItem: {
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  navItemCompact: {
    width: 48,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },

  navItemActive: {
    backgroundColor: '#EDF3FF',
  },

  navItemPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  navIconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconBoxActive: {
    backgroundColor: '#FFFFFF',
  },

  navIcon: {
    fontSize: 18,
    lineHeight: 18,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },

  navIconActive: {
    color: theme.colors.primary,
  },

  navLabel: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },

  navLabelActive: {
    color: theme.colors.primary,
    fontWeight: '800',
  },

  /* ---------------------------------------------------------------------- */
  /* HEADER ACTIONS                                                         */
  /* ---------------------------------------------------------------------- */

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 9,
    minWidth: 270,
  },

  searchContainer: {
    height: 40,
    width: 175,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DCE4F0',
    backgroundColor: '#F8FAFD',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 7,
  },

  searchIcon: {
    color: '#718096',
    fontSize: 19,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 13,
    paddingVertical: 0,
  },

  searchShortcut: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8F0',
  },

  searchShortcutText: {
    color: '#8A96A8',
    fontSize: 9,
    fontWeight: '700',
  },

  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#DCE4F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  headerActionIcon: {
    fontSize: 21,
    color: theme.colors.textSecondary,
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E99A32',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  profileWrapper: {
    position: 'relative',
    zIndex: 50,
  },

  profileButton: {
    minWidth: 52,
    height: 40,
    borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: '#F3F6FC',
    borderWidth: 1,
    borderColor: '#DCE4F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },

  profileButtonActive: {
    backgroundColor: '#EAF0FF',
    borderColor: '#BFD0FF',
  },

  profileLetter: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingTop: 5,
    overflow: 'hidden',
  },

  profileChevron: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },

  profileMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 240,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7F0',
    ...theme.shadows.medium,
  },

  profileMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
  },

  profileMenuAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileMenuAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  profileMenuIdentity: {
    flex: 1,
    minWidth: 0,
  },

  profileMenuTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },

  profileEmail: {
    marginTop: 2,
    color: theme.colors.textMuted,
    fontSize: 11,
  },

  logoutButton: {
    marginTop: 10,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF4F4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 8,
  },

  logoutButtonPressed: {
    opacity: 0.7,
  },

  logoutIcon: {
    color: '#D9535F',
    fontSize: 19,
    fontWeight: '800',
  },

  logoutText: {
    color: '#D9535F',
    fontSize: 13,
    fontWeight: '800',
  },

  headerLogoutButton: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: '#FFF4F4',
    borderWidth: 1,
    borderColor: '#F4D0D3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  headerLogoutButtonPressed: {
    opacity: 0.72,
  },

  headerLogoutIcon: {
    color: '#D9535F',
    fontSize: 19,
    fontWeight: '800',
  },

  headerLogoutText: {
    color: '#D9535F',
    fontSize: 13,
    fontWeight: '800',
  },

  logoutButtonDisabled: {
    opacity: 0.6,
  },

  /* ---------------------------------------------------------------------- */
  /* MOBILE HEADER                                                          */
  /* ---------------------------------------------------------------------- */

  mobileHeader: {
    minHeight: 68,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
  },

  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  mobileLogoFrame: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  mobileLogoImage: {
    width: 36,
    height: 36,
  },

  mobileBrandName: {
    color: theme.colors.text,
    fontSize: 19,
    lineHeight: 19,
    fontWeight: '800',
  },

  mobileBrandSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },

  mobileLogoutButton: {
    height: 38,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#FFF4F4',
    borderWidth: 1,
    borderColor: '#F4D0D3',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  mobileLogoutIcon: {
    color: '#D9535F',
    fontSize: 18,
    fontWeight: '800',
  },

  mobileLogoutText: {
    color: '#D9535F',
    fontSize: 13,
    fontWeight: '800',
  },

  /* ---------------------------------------------------------------------- */
  /* MOBILE                                                                 */
  /* ---------------------------------------------------------------------- */

  mobileShell: {
    flex: 1,

    backgroundColor:
      theme.colors.background,
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

    backgroundColor:
      'rgba(255,255,255,0.94)',

    borderWidth: 1,
    borderColor:
      theme.colors.border,

    flexDirection: 'row',
    alignItems: 'center',

    justifyContent:
      'space-around',

    ...theme.shadows.medium,

    ...(Platform.OS === 'web'
      ? ({
          backdropFilter:
            'blur(20px)',
          WebkitBackdropFilter:
            'blur(20px)',
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
    backgroundColor:
      theme.colors.primaryLight,
  },

  mobileNavIcon: {
    fontSize: 19,

    color:
      theme.colors.textMuted,
  },

  mobileNavIconActive: {
    color:
      theme.colors.primary,
  },

  mobileNavLabel: {
    fontSize: 9,
    lineHeight: 12,

    fontWeight: '700',

    color:
      theme.colors.textMuted,
  },

  mobileNavLabelActive: {
    color:
      theme.colors.primary,

    fontWeight: '800',
  },

});
