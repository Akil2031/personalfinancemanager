import React, { useState } from 'react';

import {
  Alert,
  Image,
  ImageStyle,
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
  useAuth,
} from '../context/AuthContext';

interface NavigationItem {
  label: string;
  shortLabel: string;
  icon: string;
  path: string;
}

const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', icon: '\u2302', path: '/' },
  { label: 'Loans', shortLabel: 'Loans', icon: '\u25C8', path: '/loans' },
  { label: 'Calculator', shortLabel: 'Calc', icon: '+', path: '/calculator' },
  { label: 'Insights', shortLabel: 'Insights', icon: '\u2726', path: '/insights' },
];

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isDesktop = width >= 1050;
  const isTablet = width >= 700;
  const showSearch = Platform.OS === 'web' && width >= 900;

  function navigate(path: string) {
    setProfileOpen(false);
    router.push(path as any);
  }

  function isActive(path: string) {
    if (path === '/') {
      return pathname === '/' || pathname === '';
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  }

  async function performLogout() {
    try {
      setLoggingOut(true);
      setProfileOpen(false);
      await logout();
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
          onPress: performLogout,
        },
      ],
    );
  }

  const userEmail = user?.email || 'Signed in';

  return (
    <View style={styles.header}>
      <View style={styles.topAccent} />

      <View style={[
        styles.topBar,
        !isDesktop && styles.topBarTablet,
        !isTablet && styles.topBarMobile,
      ]}>

        {/* BRAND */}
        <Pressable
          style={[
            styles.brand,
            !isDesktop && styles.brandCompact,
          ]}
          onPress={() => navigate('/')}
        >
          <View style={styles.logoFrame}>
            <Image
              source={require('../../assets/finance-logo.png')}
              style={styles.logoImage as ImageStyle}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandTextContainer}>
            <Text style={styles.brandName}>
              Finance
            </Text>
            <Text style={styles.brandSubtitle}>
              PERSONAL FINANCE MANAGER
            </Text>
            <Text style={styles.brandSlogan}>
              Plan Smarter • Spend Better • Grow Stronger
            </Text>
          </View>
        </Pressable>

        {/* PRIMARY NAVIGATION */}
        <View style={styles.navigation}>
          {navigationItems.map((item) => {
            const active = isActive(item.path);

            return (
              <Pressable
                key={item.path}
                onPress={() => navigate(item.path)}
                style={({ pressed }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
              >
                <View style={[
                  styles.navIcon,
                  active && styles.navIconActive,
                ]}>
                  <Text style={[
                    styles.navIconText,
                    active && styles.navIconTextActive,
                  ]}>
                    {item.icon}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {isDesktop ? item.label : item.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* RIGHT SIDE */}
        <View style={styles.rightSide}>

          {showSearch && (
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>\u2315</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor="#7B8AA0"
              />
              <View style={styles.searchShortcut}>
                <Text style={styles.searchShortcutText}>\u2318 K</Text>
              </View>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
            ]}
            accessibilityLabel="Notifications"
          >
            <Text style={styles.actionIcon}>\u2667</Text>
            <View style={styles.notificationDot} />
          </Pressable>

          <View style={styles.profileWrapper}>
            <Pressable
              style={[
                styles.profile,
                profileOpen && styles.profileActive,
              ]}
              onPress={() => setProfileOpen((previous) => !previous)}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileText}>A</Text>
              </View>

              {isDesktop && (
                <Text style={styles.profileChevron}>
                  \u2304
                </Text>
              )}
            </Pressable>

            {profileOpen && (
              <View style={styles.profileMenu}>
                <View style={styles.profileMenuHeader}>
                  <View style={styles.profileMenuAvatar}>
                    <Text style={styles.profileMenuAvatarText}>A</Text>
                  </View>

                  <View style={styles.profileMenuIdentity}>
                    <Text style={styles.profileMenuTitle}>
                      My Account
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={styles.profileEmail}
                    >
                      {userEmail}
                    </Text>
                  </View>
                </View>

                <View style={styles.profileMenuDivider} />

                <Pressable
                  disabled={loggingOut}
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.logoutButton,
                    pressed && styles.logoutButtonPressed,
                    loggingOut && styles.logoutButtonDisabled,
                  ]}
                >
                  <Text style={styles.logoutIcon}>\u21AA</Text>
                  <Text style={styles.logoutText}>
                    {loggingOut ? 'Logging out...' : 'Logout'}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4EAF2',
    position: 'relative',
    zIndex: 1000,
    overflow: 'visible',
  },

  topAccent: {
    height: 2,
    width: '100%',
    backgroundColor: '#E9B96E',
  },

  topBar: {
    width: '100%',
    minHeight: 74,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    zIndex: 1001,
    overflow: 'visible',
  },

  topBarTablet: {
    paddingHorizontal: 12,
  },

  topBarMobile: {
    minHeight: 66,
    paddingHorizontal: 10,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 255,
    flexShrink: 0,
  },

  brandCompact: {
    width: 175,
  },

  logoFrame: {
    width: 56,
    height: 56,
    borderRadius: 15,
    backgroundColor: '#F5F8FC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },

  logoImage: {
    width: 51,
    height: 51,
  },

  brandTextContainer: {
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 22,
    lineHeight: 23,
    fontWeight: '800',
    color: '#16213A',
    letterSpacing: -0.35,
  },

  brandSubtitle: {
    marginTop: 2,
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.65,
    color: '#71809A',
  },

  brandSlogan: {
    marginTop: 2,
    fontSize: 8.5,
    lineHeight: 10,
    fontWeight: '700',
    letterSpacing: 0.25,
    color: '#356AF3',
  },

  navigation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },

  navItem: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    position: 'relative',
  },

  navItemActive: {
    backgroundColor: '#EEF4FF',
  },

  navItemPressed: {
    opacity: 0.68,
  },

  navIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconActive: {
    backgroundColor: '#FFFFFF',
  },

  navIconText: {
    fontSize: 17,
    lineHeight: 18,
    fontWeight: '700',
    color: '#7A879A',
  },

  navIconTextActive: {
    color: '#356AF3',
  },

  navLabel: {
    fontSize: 15,
    lineHeight: 17,
    fontWeight: '600',
    color: '#647188',
  },

  navLabelActive: {
    color: '#356AF3',
    fontWeight: '800',
  },

  rightSide: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    position: 'relative',
    zIndex: 2000,
  },

  searchContainer: {
    width: 170,
    height: 40,
    paddingLeft: 9,
    paddingRight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE4EF',
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
  },

  searchIcon: {
    width: 25,
    textAlign: 'center',
    fontSize: 21,
    color: '#71809A',
  },

  searchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 3,
    fontSize: 14,
    color: '#1D2940',
    outlineStyle: 'none',
  } as any,

  searchShortcut: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: '#EDF2F8',
  },

  searchShortcutText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8793A5',
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    position: 'relative',
  },

  actionButtonPressed: {
    opacity: 0.7,
  },

  actionIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#53627A',
  },

  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#356AF3',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  profileWrapper: {
    position: 'relative',
    zIndex: 9999,
    flexShrink: 0,
  },

  profile: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: 5,
    paddingRight: 9,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F4F7FC',
    borderWidth: 1,
    borderColor: '#DCE4EF',
  },

  profileActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C9D8FF',
  },

  profileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#356AF3',
  },

  profileText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  profileChevron: {
    marginTop: -3,
    fontSize: 17,
    color: '#708099',
  },

  profileMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 270,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 15,
    shadowColor: '#17233A',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 99999,
    overflow: 'visible',
  },

  profileMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  profileMenuAvatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#356AF3',
    marginRight: 10,
  },

  profileMenuAvatarText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  profileMenuIdentity: {
    flex: 1,
    minWidth: 0,
  },

  profileMenuTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18243A',
  },

  profileEmail: {
    marginTop: 3,
    fontSize: 12,
    color: '#7B879A',
  },

  profileMenuDivider: {
    height: 1,
    marginVertical: 13,
    backgroundColor: '#E9EEF5',
  },

  logoutButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 9,
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
    fontSize: 20,
    color: '#C62828',
  },

  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C62828',
  },
});

