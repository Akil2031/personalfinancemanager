import React, { useEffect } from 'react';

import {
  Stack,
  useRouter,
  useSegments,
} from 'expo-router';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';

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

  const router = useRouter();

  const segments = useSegments();


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

      router.replace('/login');

      return;
    }


    if (
      user &&
      inLoginScreen
    ) {

      router.replace('/');
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

        <ActivityIndicator size="large" />

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

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });


  if (!fontsLoaded) {

    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F5F7FA',
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }


  return (
    <AuthProvider>

      <AuthGate />

    </AuthProvider>
  );
}