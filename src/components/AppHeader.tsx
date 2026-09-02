import React, {
  useState,
} from 'react';

import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  usePathname,
  useRouter,
} from 'expo-router';

import {
  colors,
} from '../config/theme';

import {
  useAuth,
} from '../context/AuthContext';


const navigationItems = [
  {
    label: 'Dashboard',
    path: '/',
  },
  {
    label: 'Loans',
    path: '/loans',
  },
  {
    label: 'Calculator',
    path: '/calculator',
  },
  {
    label: 'Payments',
    path: '/payments',
  },
  {
    label: 'Insights',
    path: '/insights',
  },
];


export default function AppHeader() {

  const router =
    useRouter();

  const pathname =
    usePathname();

  const {
    user,
    logout,
  } = useAuth();

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    loggingOut,
    setLoggingOut,
  ] = useState(false);


  function navigate(
    path: string
  ) {

    setProfileOpen(false);

    router.push(
      path as any
    );
  }


  function isActive(
    path: string
  ) {

    if (path === '/') {

      return (
        pathname === '/' ||
        pathname === ''
      );
    }

    return pathname.startsWith(
      path
    );
  }


  async function handleLogout() {

    if (loggingOut) {
      return;
    }


    /*
     * Web confirmation
     */
    if (Platform.OS === 'web') {

      const confirmed =
        window.confirm(
          'Are you sure you want to logout?'
        );

      if (!confirmed) {
        return;
      }

    }


    /*
     * Native confirmation
     */
    if (Platform.OS !== 'web') {

      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              await performLogout();
            },
          },
        ]
      );

      return;
    }


    await performLogout();
  }


  async function performLogout() {

    try {

      setLoggingOut(
        true
      );

      setProfileOpen(
        false
      );

      await logout();

      /*
       * Do not manually navigate here.
       *
       * AuthGate in app/_layout.tsx
       * watches Firebase auth state and
       * automatically redirects to /login.
       */

    } catch (error) {

      console.error(
        'Logout failed:',
        error
      );


      const message =
        error instanceof Error
          ? error.message
          : 'Unable to logout. Please try again.';


      if (Platform.OS === 'web') {

        window.alert(
          message
        );

      } else {

        Alert.alert(
          'Logout Failed',
          message
        );

      }

    } finally {

      setLoggingOut(
        false
      );

    }
  }


  /*
   * Display name/email for the profile
   */

  const userEmail =
    user?.email ||
    'Signed in';


  return (
    <View
      style={styles.header}
    >

      {/* =====================================================
          TOP HEADER
         ===================================================== */}

      <View
        style={styles.topBar}
      >

        {/* BRAND */}

        <Pressable
          style={styles.brand}
          onPress={() =>
            navigate('/')
          }
        >

          <View
            style={styles.logo}
          >

            <Text
              style={styles.logoText}
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
              Personal Financial Manager
            </Text>


            <Text
              style={styles.brandSubtitle}
            >
              Your financial control center
            </Text>

          </View>

        </Pressable>


        {/* SEARCH */}

        {Platform.OS === 'web' && (

          <View
            style={
              styles.searchContainer
            }
          >

            <Text
              style={styles.searchIcon}
            >
              ⌕
            </Text>


            <TextInput
              style={
                styles.searchInput
              }
              placeholder={
                'Search loans, payments, reports...'
              }
              placeholderTextColor="#89958D"
            />

          </View>

        )}


        {/* HEADER ACTIONS */}

        <View
          style={styles.headerActions}
        >

          <Pressable
            style={styles.headerAction}
          >

            <Text
              style={styles.actionIcon}
            >
              ?
            </Text>

          </Pressable>


          <Pressable
            style={styles.headerAction}
          >

            <Text
              style={styles.actionIcon}
            >
              ♧
            </Text>

          </Pressable>


          <View
            style={styles.actionDivider}
          />


          {/* PROFILE */}

          <View
            style={
              styles.profileWrapper
            }
          >

            <Pressable
              style={[
                styles.profile,
                profileOpen &&
                  styles.profileActive,
              ]}
              onPress={() =>
                setProfileOpen(
                  previous =>
                    !previous
                )
              }
            >

              <Text
                style={styles.profileText}
              >
                PF
              </Text>

            </Pressable>


            {/* PROFILE MENU */}

            {profileOpen && (

              <View
                style={
                  styles.profileMenu
                }
              >

                <Text
                  style={
                    styles.profileMenuTitle
                  }
                >
                  Account
                </Text>


                <Text
                  numberOfLines={1}
                  style={
                    styles.profileEmail
                  }
                >
                  {userEmail}
                </Text>


                <View
                  style={
                    styles.profileMenuDivider
                  }
                />


                <Pressable
                  disabled={loggingOut}
                  onPress={
                    handleLogout
                  }
                  style={({ pressed }) => [
                    styles.logoutButton,
                    pressed &&
                      styles.logoutButtonPressed,
                    loggingOut &&
                      styles.logoutButtonDisabled,
                  ]}
                >

                  <Text
                    style={
                      styles.logoutIcon
                    }
                  >
                    ↪
                  </Text>


                  <Text
                    style={
                      styles.logoutText
                    }
                  >
                    {loggingOut
                      ? 'Logging out...'
                      : 'Logout'}
                  </Text>

                </Pressable>

              </View>

            )}

          </View>

        </View>

      </View>


      {/* =====================================================
          PRIMARY NAVIGATION
         ===================================================== */}

      <View
        style={styles.navigationBar}
      >

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.navigationContent
          }
        >

          {navigationItems.map(
            item => {

              const active =
                isActive(
                  item.path
                );


              return (

                <Pressable
                  key={item.path}
                  onPress={() =>
                    navigate(
                      item.path
                    )
                  }
                  style={({
                    pressed,
                  }) => [

                    styles.navItem,

                    active &&
                      styles.navItemActive,

                    pressed &&
                      styles.navItemPressed,

                  ]}
                >

                  <Text
                    style={[
                      styles.navText,

                      active &&
                        styles.navTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>


                  {active && (

                    <View
                      style={
                        styles.activeIndicator
                      }
                    />

                  )}

                </Pressable>

              );
            }
          )}

        </ScrollView>

      </View>

    </View>
  );
}


const styles =
  StyleSheet.create({

    /*
     * =====================================================
     * HEADER
     * =====================================================
     */

    header: {
      width: '100%',
      backgroundColor: '#FFFFFF',

      borderBottomWidth: 1,
      borderBottomColor: '#DDE7E0',

      position: 'relative',

      zIndex: 1000,

      overflow: 'visible',
    },


    /*
     * =====================================================
     * TOP BAR
     * =====================================================
     */

    topBar: {
      width: '100%',
      minHeight: 72,

      paddingHorizontal: 32,

      flexDirection: 'row',
      alignItems: 'center',

      backgroundColor: '#FFFFFF',

      position: 'relative',

      zIndex: 1001,

      overflow: 'visible',
    },


    /*
     * =====================================================
     * BRAND
     * =====================================================
     */

    brand: {
      flexDirection: 'row',
      alignItems: 'center',

      minWidth: 285,
      flexShrink: 0,
    },


    logo: {
      width: 44,
      height: 44,

      borderRadius: 12,

      backgroundColor:
        colors.primary,

      alignItems: 'center',
      justifyContent: 'center',

      marginRight: 12,
    },


    logoText: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '800',
    },


    brandTextContainer: {
      justifyContent: 'center',
    },


    brandName: {
      fontSize: 15,
      lineHeight: 19,

      fontWeight: '800',

      color: '#17231B',
    },


    brandSubtitle: {
      marginTop: 2,

      fontSize: 10,

      color: '#7A877F',
    },


    /*
     * =====================================================
     * SEARCH
     * =====================================================
     */

    searchContainer: {
      flex: 1,

      maxWidth: 620,
      minWidth: 280,

      height: 44,

      marginHorizontal: 30,

      flexDirection: 'row',
      alignItems: 'center',

      borderWidth: 1,
      borderColor: '#D5DFD8',

      borderRadius: 10,

      backgroundColor: '#F8FAF9',
    },


    searchIcon: {
      width: 45,

      textAlign: 'center',

      fontSize: 25,

      color: '#536159',
    },


    searchInput: {
      flex: 1,

      height: '100%',

      paddingHorizontal: 5,

      fontSize: 13,

      color: '#1B271F',

      outlineStyle: 'none',
    } as any,


    /*
     * =====================================================
     * HEADER ACTIONS
     * =====================================================
     */

    headerActions: {
      marginLeft: 'auto',

      flexDirection: 'row',
      alignItems: 'center',

      gap: 8,

      flexShrink: 0,
      position: 'relative',
      zIndex: 2000,
    },


    headerAction: {
      width: 38,
      height: 38,

      borderRadius: 10,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor: '#F3F7F4',
    },


    actionIcon: {
      fontSize: 17,

      fontWeight: '700',

      color: '#506057',
    },


    actionDivider: {
      width: 1,
      height: 28,

      marginHorizontal: 7,

      backgroundColor: '#DDE5DF',
    },


    /*
     * =====================================================
     * PROFILE
     * =====================================================
     */

    profileWrapper: {
      position: 'relative',
      zIndex: 9999,
      flexShrink: 0,
    },


    profile: {
      width: 40,
      height: 40,

      borderRadius: 20,

      backgroundColor:
        '#DDF4E5',

      alignItems: 'center',
      justifyContent: 'center',

      borderWidth: 1,
      borderColor: '#B9E5C7',
    },


    profileActive: {
      backgroundColor:
        '#CBECD7',
    },


    profileText: {
      fontSize: 12,

      fontWeight: '800',

      color: '#16803A',
    },


    /*
     * =====================================================
     * PROFILE MENU
     * =====================================================
     */

    profileMenu: {
      position: 'absolute',

      top: 48,
      right: 0,

      width: 240,

      padding: 16,

      backgroundColor: '#FFFFFF',

      borderWidth: 1,
      borderColor: '#DDE7E0',

      borderRadius: 12,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.15,
      shadowRadius: 14,

      elevation: 20,

      zIndex: 99999,
      overflow: 'visible',
    },


    profileMenuTitle: {
      fontSize: 13,

      fontWeight: '800',

      color: '#17231B',
    },


    profileEmail: {
      marginTop: 5,

      fontSize: 11,

      color: '#7A877F',
    },


    profileMenuDivider: {
      height: 1,

      marginVertical: 13,

      backgroundColor: '#E7EEE9',
    },


    logoutButton: {
      minHeight: 40,

      paddingHorizontal: 10,

      borderRadius: 8,

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
      fontSize: 13,

      fontWeight: '700',

      color: '#C62828',
    },


    /*
     * =====================================================
     * NAVIGATION
     * =====================================================
     */

    navigationBar: {
      width: '100%',

      height: 50,

      backgroundColor: '#FFFFFF',

      borderTopWidth: 1,
      borderTopColor: '#F0F3F1',
      position: 'relative',
      zIndex: 1,
    },


    navigationContent: {
      paddingHorizontal: 24,

      minWidth: '100%',

      alignItems: 'stretch',
    },


    navItem: {
      minWidth: 115,

      height: 50,

      paddingHorizontal: 20,

      alignItems: 'center',
      justifyContent: 'center',

      position: 'relative',
    },


    navItemActive: {
      backgroundColor: '#F0FAF3',
    },


    navItemPressed: {
      opacity: 0.7,
    },


    navText: {
      fontSize: 13,

      fontWeight: '600',

      color: '#56635B',
    },


    navTextActive: {
      color: '#16803A',

      fontWeight: '800',
    },


    activeIndicator: {
      position: 'absolute',

      left: 18,
      right: 18,

      bottom: 0,

      height: 3,

      backgroundColor:
        '#16803A',

      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
    },

  });