import React, {
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useRouter,
} from 'expo-router';

import {
  signIn,
} from '../src/services/authService';


export default function LoginScreen() {

  const router =
    useRouter();


  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');


  async function handleLogin() {

    setError('');


    if (!email.trim()) {
      setError(
        'Please enter your email address.'
      );
      return;
    }


    if (!password) {
      setError(
        'Please enter your password.'
      );
      return;
    }


    try {

      setLoading(true);


      await signIn(
        email,
        password
      );


      router.replace('/');


    } catch (error: any) {

      console.error(
        'Login failed:',
        error
      );


      let message =
        'Unable to login. Please try again.';


      switch (error?.code) {

        case 'auth/invalid-email':
          message =
            'Please enter a valid email address.';
          break;

        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message =
            'Invalid email or password.';
          break;

        case 'auth/too-many-requests':
          message =
            'Too many login attempts. Please try again later.';
          break;

        default:
          if (error instanceof Error) {
            message =
              error.message;
          }
      }


      setError(message);

    } finally {

      setLoading(false);

    }
  }


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >

      <View
        style={styles.card}
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


        <Text
          style={styles.title}
        >
          Personal Finance Manager
        </Text>


        <Text
          style={styles.subtitle}
        >
          Sign in to manage your loans,
          payments and financial goals.
        </Text>


        <Text
          style={styles.label}
        >
          Email
        </Text>


        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={styles.input}
        />


        <Text
          style={styles.label}
        >
          Password
        </Text>


        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          style={styles.input}
        />


        {error ? (
          <View
            style={styles.errorBox}
          >
            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          </View>
        ) : null}


        <Pressable
          disabled={loading}
          onPress={handleLogin}
          style={[
            styles.loginButton,
            loading &&
              styles.loginButtonDisabled,
          ]}
        >

          {loading ? (

            <ActivityIndicator
              color="#FFFFFF"
            />

          ) : (

            <Text
              style={styles.loginButtonText}
            >
              Login
            </Text>

          )}

        </Pressable>

      </View>

    </KeyboardAvoidingView>
  );
}


const styles =
  StyleSheet.create({

    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F5F7FA',
      padding: 24,
    },

    card: {
      width: '100%',
      maxWidth: 440,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 30,
      borderWidth: 1,
      borderColor: '#E2E8F0',
    },

    logo: {
      width: 58,
      height: 58,
      borderRadius: 16,
      backgroundColor: '#DCFCE7',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 18,
    },

    logoText: {
      fontSize: 26,
      fontWeight: '800',
      color: '#16A34A',
    },

    title: {
      fontSize: 24,
      fontWeight: '800',
      color: '#0F172A',
      textAlign: 'center',
    },

    subtitle: {
      marginTop: 8,
      marginBottom: 26,
      fontSize: 14,
      lineHeight: 20,
      color: '#64748B',
      textAlign: 'center',
    },

    label: {
      marginBottom: 7,
      marginTop: 14,
      fontSize: 13,
      fontWeight: '700',
      color: '#334155',
    },

    input: {
      height: 48,
      borderWidth: 1,
      borderColor: '#CBD5E1',
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 15,
      color: '#0F172A',
      backgroundColor: '#FFFFFF',
    },

    errorBox: {
      marginTop: 16,
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#FEF2F2',
      borderWidth: 1,
      borderColor: '#FECACA',
    },

    errorText: {
      fontSize: 13,
      color: '#B91C1C',
    },

    loginButton: {
      marginTop: 22,
      height: 50,
      borderRadius: 10,
      backgroundColor: '#2563EB',
      alignItems: 'center',
      justifyContent: 'center',
    },

    loginButtonDisabled: {
      opacity: 0.7,
    },

    loginButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },

  });
