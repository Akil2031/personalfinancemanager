import React from 'react';

import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
    label: 'Payments',
    shortLabel: 'Pay',
    icon: '↘',
    route: '/payments',
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


  /* ------------------------------------------------------------------------
     MOBILE SHELL
     ------------------------------------------------------------------------ */

  if (isMobile) {
    return (
      <View
        style={styles.mobileShell}
      >
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
      {/* TOP HEADER                                                         */}
      {/* ================================================================== */}

      <View
        style={styles.headerOuter}
      >
        <View
          style={styles.header}
        >

          {/* -------------------------------------------------------------- */}
          {/* BRAND                                                          */}
          {/* -------------------------------------------------------------- */}

          <Pressable
            onPress={() =>
              router.push(
                '/' as any,
              )
            }
            style={({ pressed }) => [
              styles.brand,

              pressed &&
                styles.brandPressed,
            ]}
          >
            <View
              style={styles.brandMark}
            >
              <Text
                style={styles.brandMarkText}
              >
                ₹
              </Text>
            </View>

            <View
              style={
                styles.brandTextContainer
              }
            >
              <Text
                style={styles.brandName}
              >
                Finance
              </Text>

              <Text
                style={styles.brandSubtitle}
              >
                PERSONAL MANAGER
              </Text>
            </View>
          </Pressable>


          {/* -------------------------------------------------------------- */}
          {/* NAVIGATION                                                     */}
          {/* -------------------------------------------------------------- */}

          <View
            style={[
              styles.navigation,

              !isDesktop &&
                styles.navigationTablet,
            ]}
          >
            {navigationItems.map(
              (item) => {
                const active =
                  isRouteActive(
                    pathname,
                    item.route,
                  );

                return (
                  <DesktopNavItem
                    key={item.route}
                    item={item}
                    active={active}
                    compact={!isDesktop}
                    onPress={() =>
                      router.push(
                        item.route as any,
                      )
                    }
                  />
                );
              },
            )}
          </View>


          {/* -------------------------------------------------------------- */}
          {/* ACTIONS                                                        */}
          {/* -------------------------------------------------------------- */}

          <View
            style={
              styles.headerActions
            }
          >
            <Pressable
              style={({ pressed }) => [
                styles.headerAction,

                pressed &&
                  styles.headerActionPressed,
              ]}
            >
              <Text
                style={
                  styles.headerActionIcon
                }
              >
                ◔
              </Text>
            </Pressable>

            <View
              style={
                styles.profileButton
              }
            >
              <Text
                style={
                  styles.profileLetter
                }
              >
                ₹
              </Text>
            </View>
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
    maxWidth:
      theme.layout.maxContentWidth,

    minHeight: 72,

    alignSelf: 'center',

    paddingHorizontal:
      theme.spacing.xxl,

    flexDirection: 'row',
    alignItems: 'center',

    gap: theme.spacing.xxl,
  },


  /* ---------------------------------------------------------------------- */
  /* BRAND                                                                  */
  /* ---------------------------------------------------------------------- */

  brand: {
    flexDirection: 'row',
    alignItems: 'center',

    minWidth: 180,

    gap: 11,
  },

  brandPressed: {
    opacity: 0.72,
  },

  brandMark: {
    width: 40,
    height: 40,

    borderRadius: 13,

    backgroundColor:
      theme.colors.text,

    alignItems: 'center',
    justifyContent: 'center',

    ...theme.shadows.soft,
  },

  brandMarkText: {
    color:
      theme.colors.white,

    fontSize: 19,
    fontWeight: '800',
  },

  brandTextContainer: {
    justifyContent:
      'center',
  },

  brandName: {
    color:
      theme.colors.text,

    fontSize: 17,
    lineHeight: 20,

    fontWeight: '800',

    letterSpacing: -0.3,
  },

  brandSubtitle: {
    color:
      theme.colors.textMuted,

    fontSize: 7,
    lineHeight: 10,

    fontWeight: '800',

    letterSpacing: 1.1,

    marginTop: 1,
  },


  /* ---------------------------------------------------------------------- */
  /* NAVIGATION                                                             */
  /* ---------------------------------------------------------------------- */

  navigation: {
    flex: 1,

    flexDirection: 'row',
    alignItems: 'center',

    justifyContent:
      'center',

    gap: 5,
  },

  navigationTablet: {
    justifyContent:
      'flex-start',
  },

  navItem: {
    minHeight: 44,

    paddingHorizontal: 12,

    borderRadius:
      theme.radius.md,

    flexDirection: 'row',
    alignItems: 'center',

    gap: 8,
  },

  navItemCompact: {
    width: 48,

    paddingHorizontal: 0,

    justifyContent:
      'center',
  },

  navItemActive: {
    backgroundColor:
      theme.colors.primaryLight,
  },

  navItemPressed: {
    opacity: 0.72,

    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  navIconBox: {
    width: 27,
    height: 27,

    borderRadius: 9,

    alignItems: 'center',
    justifyContent: 'center',
  },

  navIconBoxActive: {
    backgroundColor:
      theme.colors.white,
  },

  navIcon: {
    fontSize: 15,
    lineHeight: 18,

    color:
      theme.colors.textSecondary,

    fontWeight: '700',
  },

  navIconActive: {
    color:
      theme.colors.primary,
  },

  navLabel: {
    color:
      theme.colors.textSecondary,

    fontSize: 11,
    lineHeight: 15,

    fontWeight: '700',
  },

  navLabelActive: {
    color:
      theme.colors.primary,

    fontWeight: '800',
  },


  /* ---------------------------------------------------------------------- */
  /* HEADER ACTIONS                                                         */
  /* ---------------------------------------------------------------------- */

  headerActions: {
    minWidth: 90,

    flexDirection: 'row',
    alignItems: 'center',

    justifyContent:
      'flex-end',

    gap: 10,
  },

  headerAction: {
    width: 38,
    height: 38,

    borderRadius: 12,

    backgroundColor:
      theme.colors.surface,

    borderWidth: 1,
    borderColor:
      theme.colors.border,

    alignItems: 'center',
    justifyContent: 'center',
  },

  headerActionPressed: {
    opacity: 0.65,
  },

  headerActionIcon: {
    fontSize: 18,

    color:
      theme.colors.textSecondary,
  },

  profileButton: {
    width: 38,
    height: 38,

    borderRadius: 12,

    backgroundColor:
      theme.colors.primary,

    alignItems: 'center',
    justifyContent: 'center',
  },

  profileLetter: {
    color:
      theme.colors.white,

    fontSize: 15,
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
    fontSize: 16,

    color:
      theme.colors.textMuted,
  },

  mobileNavIconActive: {
    color:
      theme.colors.primary,
  },

  mobileNavLabel: {
    fontSize: 8,
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