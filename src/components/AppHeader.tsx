import React, { useMemo, useState } from 'react';

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

import { useAuth } from '../context/AuthContext';

interface NavigationItem {
  label: string;
  shortLabel: string;
  icon: string;
  path: string;
  keywords: string[];
}

const navigationItems: NavigationItem[] = [
  {
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: '⌂',
    path: '/',
    keywords: ['dashboard', 'home', 'overview', 'summary'],
  },
  {
    label: 'Loans',
    shortLabel: 'Loans',
    icon: '◈',
    path: '/loans',
    keywords: ['loan', 'loans', 'debt', 'lender', 'emi'],
  },
  {
    label: 'Calculator',
    shortLabel: 'Calc',
    icon: '＋',
    path: '/calculator',
    keywords: ['calculator', 'calc', 'emi calculator', 'interest'],
  },
  {
    label: 'Insights',
    shortLabel: 'Insights',
    icon: '✦',
    path: '/insights',
    keywords: ['insight', 'insights', 'analysis', 'financial insights'],
  },
];

const SLOGAN = 'Plan Smart. Save More. Live Better.';

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const isDesktop = width >= 1050;
  const isTablet = width >= 700;
  const isMobileApp = Platform.OS !== 'web';
  const showSearch = Platform.OS === 'web' && width >= 900;

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return navigationItems
      .filter((item) => {
        const haystack = [
          item.label,
          item.shortLabel,
          ...item.keywords,
        ]
          .join(' ')
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 5);
  }, [search]);

  function navigate(path: string) {
    setProfileOpen(false);
    setNotificationOpen(false);
    setSearch('');
    router.push(path as any);
  }

  function isActive(path: string) {
    if (path === '/') {
      return pathname === '/' || pathname === '' || pathname === '/index';
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  }

  function handleSearchSubmit() {
    const query = search.trim().toLowerCase();
    if (!query) return;

    const exact = navigationItems.find(
      (item) =>
        item.label.toLowerCase() === query ||
        item.shortLabel.toLowerCase() === query,
    );

    const result = exact ?? searchResults[0];
    if (result) {
      navigate(result.path);
    }
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
  const profileInitial =
    user?.displayName?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    'A';

  function toggleNotifications() {
    setNotificationOpen((previous) => !previous);
    setProfileOpen(false);
  }

  function toggleProfile() {
    setProfileOpen((previous) => !previous);
    setNotificationOpen(false);
  }

  return (
    <View style={styles.header}>
      <View style={styles.topAccent} />

      <View
        style={[
          styles.topBar,
          !isDesktop && styles.topBarTablet,
          !isTablet && styles.topBarMobile,
        ]}
      >
        {/* BRAND */}
        <Pressable
          style={[
            styles.brand,
            !isDesktop && styles.brandCompact,
          ]}
          onPress={() => navigate('/')}
          accessibilityRole="button"
          accessibilityLabel="Personal Finance Manager home"
        >
          <View style={styles.logoFrame}>
            <Image
              source={require('../../assets/finance-logo.png')}
              style={styles.logoImage as ImageStyle}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandTextContainer}>
            <Text style={styles.brandName} numberOfLines={1}>
              Personal Finance Manager
            </Text>
            <Text style={styles.brandSubtitle} numberOfLines={1}>
              {SLOGAN}
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
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                {/* Icons are deliberately shown only inside native mobile apps. */}
                {isMobileApp && (
                  <View
                    style={[
                      styles.navIcon,
                      active && styles.navIconActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.navIconText,
                        active && styles.navIconTextActive,
                      ]}
                    >
                      {item.icon}
                    </Text>
                  </View>
                )}

                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {isDesktop || !isMobileApp
                    ? item.label
                    : item.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* RIGHT SIDE */}
        <View style={styles.rightSide}>
          {showSearch && (
            <View style={styles.searchWrapper}>
              <View
                style={[
                  styles.searchContainer,
                  search.length > 0 && styles.searchContainerFocused,
                ]}
              >
                <Text style={styles.searchIcon}>⌕</Text>

                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                  style={styles.searchInput}
                  placeholder="Search"
                  placeholderTextColor="#7B8AA0"
                  autoCorrect={false}
                  accessibilityLabel="Search"
                />

                <View style={styles.searchShortcut}>
                  <Text style={styles.searchShortcutText}>⌘ K</Text>
                </View>
              </View>

              {search.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <Pressable
                        key={item.path}
                        onPress={() => navigate(item.path)}
                        style={({ pressed }) => [
                          styles.searchResult,
                          pressed && styles.searchResultPressed,
                        ]}
                      >
                        <View style={styles.searchResultIcon}>
                          <Text style={styles.searchResultIconText}>
                            {item.icon}
                          </Text>
                        </View>
                        <View style={styles.searchResultTextWrap}>
                          <Text style={styles.searchResultTitle}>
                            {item.label}
                          </Text>
                          <Text style={styles.searchResultHint}>
                            Open {item.label}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.noSearchResults}>
                      <Text style={styles.noSearchResultsTitle}>
                        No matching section
                      </Text>
                      <Text style={styles.noSearchResultsText}>
                        Try Dashboard, Loans, Calculator or Insights.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* NOTIFICATIONS */}
          <View style={styles.notificationWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                notificationOpen && styles.actionButtonActive,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={toggleNotifications}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              accessibilityState={{ expanded: notificationOpen }}
            >
              <Text style={styles.actionIcon}>♧</Text>
              <View style={styles.notificationDot} />
            </Pressable>

            {notificationOpen && (
              <View style={styles.notificationMenu}>
                <View style={styles.dropdownHeader}>
                  <View>
                    <Text style={styles.dropdownTitle}>Notifications</Text>
                    <Text style={styles.dropdownSubtitle}>
                      Your latest account updates
                    </Text>
                  </View>
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>0</Text>
                  </View>
                </View>

                <View style={styles.notificationEmpty}>
                  <Text style={styles.notificationEmptyIcon}>✓</Text>
                  <Text style={styles.notificationEmptyTitle}>
                    You're all caught up
                  </Text>
                  <Text style={styles.notificationEmptyText}>
                    No new notifications right now.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* PROFILE */}
          <View style={styles.profileWrapper}>
            <Pressable
              style={[
                styles.profile,
                profileOpen && styles.profileActive,
              ]}
              onPress={toggleProfile}
              accessibilityRole="button"
              accessibilityLabel="Profile"
              accessibilityState={{ expanded: profileOpen }}
            >
              <View style={styles.profileAvatar}>
                <Text style={styles.profileText}>
                  {profileInitial}
                </Text>
              </View>

              {isDesktop && (
                <Text style={styles.profileChevron}>
                  {profileOpen ? '⌃' : '⌄'}
                </Text>
              )}
            </Pressable>

            {profileOpen && (
              <View style={styles.profileMenu}>
                <View style={styles.profileMenuHeader}>
                  <View style={styles.profileMenuAvatar}>
                    <Text style={styles.profileMenuAvatarText}>
                      {profileInitial}
                    </Text>
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

                <View style={styles.accountInfoRow}>
                  <Text style={styles.accountInfoLabel}>Status</Text>
                  <Text style={styles.accountInfoValue}>Signed in</Text>
                </View>

                <Pressable
                  disabled={loggingOut}
                  onPress={handleLogout}
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
    minHeight: 78,
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
    width: 320,
    flexShrink: 0,
  },

  brandCompact: {
    width: 210,
  },

  logoFrame: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#F5F8FC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },

  logoImage: {
    width: 53,
    height: 53,
  },

  brandTextContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '800',
    color: '#16213A',
    letterSpacing: -0.25,
  },

  brandSubtitle: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    letterSpacing: 0.35,
    color: '#71809A',
  },

  navigation: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 0,
  },

  navItem: {
    minHeight: 46,
    paddingHorizontal: 15,
    borderRadius: 13,
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
    fontSize: 16,
    lineHeight: 19,
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

  searchWrapper: {
    position: 'relative',
    zIndex: 3000,
  },

  searchContainer: {
    width: 175,
    height: 40,
    paddingLeft: 8,
    paddingRight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE4EF',
    borderRadius: 12,
    backgroundColor: '#F8FAFD',
  },

  searchContainerFocused: {
    borderColor: '#AFC4FF',
    backgroundColor: '#FFFFFF',
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

  searchResults: {
    position: 'absolute',
    top: 46,
    left: 0,
    width: 300,
    padding: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 13,
    shadowColor: '#17233A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 20,
    zIndex: 99999,
  },

  searchResult: {
    minHeight: 50,
    paddingHorizontal: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchResultPressed: {
    backgroundColor: '#F2F6FF',
  },

  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FB',
    marginRight: 10,
  },

  searchResultIconText: {
    fontSize: 16,
    color: '#356AF3',
  },

  searchResultTextWrap: {
    flex: 1,
  },

  searchResultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D2940',
  },

  searchResultHint: {
    marginTop: 2,
    fontSize: 11,
    color: '#8793A5',
  },

  noSearchResults: {
    padding: 14,
  },

  noSearchResultsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D2940',
  },

  noSearchResultsText: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
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

  actionButtonActive: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C9D8FF',
  },

  actionButtonPressed: {
    opacity: 0.7,
  },

  actionIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#53627A',
  },

  notificationWrapper: {
    position: 'relative',
    zIndex: 9999,
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

  notificationMenu: {
    position: 'absolute',
    top: 48,
    right: -8,
    width: 310,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 15,
    shadowColor: '#17233A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 99999,
  },

  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dropdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#18243A',
  },

  dropdownSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: '#7B879A',
  },

  notificationBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },

  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#356AF3',
  },

  notificationEmpty: {
    marginTop: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 11,
    backgroundColor: '#F8FAFD',
  },

  notificationEmptyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    textAlign: 'center',
    lineHeight: 32,
    fontSize: 16,
    fontWeight: '800',
    color: '#16803A',
    backgroundColor: '#EAF8EF',
  },

  notificationEmptyTitle: {
    marginTop: 9,
    fontSize: 13,
    fontWeight: '800',
    color: '#1D2940',
  },

  notificationEmptyText: {
    marginTop: 4,
    fontSize: 11,
    color: '#8793A5',
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
    marginTop: -2,
    fontSize: 16,
    color: '#708099',
  },

  profileMenu: {
    position: 'absolute',
    top: 48,
    right: 0,
    width: 285,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7F0',
    borderRadius: 15,
    shadowColor: '#17233A',
    shadowOffset: { width: 0, height: 8 },
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
    width: 40,
    height: 40,
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

  accountInfoRow: {
    minHeight: 30,
    marginBottom: 10,
    paddingHorizontal: 9,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFD',
  },

  accountInfoLabel: {
    fontSize: 11,
    color: '#7B879A',
  },

  accountInfoValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16803A',
  },

  logoutButton: {
    minHeight: 42,
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
