import React, {
  useEffect,
} from 'react';

import {
  Stack,
  useRouter,
  useSegments,
} from 'expo-router';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import AppShell from '../src/components/AppShell';

import {
  AuthProvider,
  useAuth,
} from '../src/context/AuthContext';


function AuthGate() {

  const {
    user,
    loading,
  } = useAuth();

  const router =
    useRouter();

  const segments =
    useSegments();


  useEffect(() => {

    if (loading) {
      return;
    }

    const inLoginScreen =
      segments[0] === 'login';


    if (
      !user &&
      !inLoginScreen
    ) {

      router.replace(
        '/login'
      );

      return;
    }


    if (
      user &&
      inLoginScreen
    ) {

      router.replace(
        '/'
      );
    }

  }, [
    user,
    loading,
    segments,
  ]);


  if (loading) {

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F5F7FA',
        }}
      >

        <ActivityIndicator
          size="large"
        />

      </View>
    );
  }


  return (
    <AppShell>

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />

    </AppShell>
  );
}


export default function RootLayout() {

  return (
    <AuthProvider>

      <AuthGate />

    </AuthProvider>
  );
}