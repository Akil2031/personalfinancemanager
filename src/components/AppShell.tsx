import React, {
  ReactNode,
} from 'react';

import {
  Platform,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';

import AppHeader from './AppHeader';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({
  children,
}: AppShellProps) {
  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={styles.container}
      >

        {/* ==========================================
            COMMON WEB HEADER
            ========================================== */}

        {Platform.OS === 'web' && (
          <AppHeader />
        )}

        {/* ==========================================
            SCREEN CONTENT
            ========================================== */}

        <View
          style={styles.content}
        >
          {children}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({

    safeArea: {
      flex: 1,

      backgroundColor:
        '#F4F8F5',
    },

    container: {
      flex: 1,

      width: '100%',

      backgroundColor:
        '#F4F8F5',
    },

    content: {
      flex: 1,

      width: '100%',
    },

  });