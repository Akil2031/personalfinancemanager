import React, { useState } from 'react';

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { useRouter } from 'expo-router';

import { signIn } from '../src/services/authService';

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      await signIn(email, password);
      router.replace('/');
    } catch (error: any) {
      console.error('Login failed:', error);

      let message = 'Unable to login. Please try again.';

      switch (error?.code) {
        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message = 'Invalid email or password.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many login attempts. Please try again later.';
          break;
        default:
          if (error instanceof Error) {
            message = error.message;
          }
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isCompact && styles.scrollContentCompact,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundShapeTop} />
        <View style={styles.backgroundShapeBottom} />

        <View style={[styles.layout, isCompact && styles.layoutCompact]}>
          <View style={[styles.brandPanel, isCompact && styles.brandPanelCompact]}>
            <View style={styles.logoHalo}>
              <Image
                source={require('../assets/finance-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.brandEyebrow}>WELCOME BACK</Text>
            <Text style={styles.brandTitle}>Personal Finance Manager</Text>
            <Text style={styles.brandDescription}>
              One clear view of your loans, repayments and financial goals.
            </Text>

            <View style={styles.brandHighlights}>
              <View style={styles.highlightItem}>
                <View style={[styles.highlightDot, styles.dotBlue]} />
                <Text style={styles.highlightText}>Track every loan</Text>
              </View>
              <View style={styles.highlightItem}>
                <View style={[styles.highlightDot, styles.dotGold]} />
                <Text style={styles.highlightText}>Plan your payoff</Text>
              </View>
              <View style={styles.highlightItem}>
                <View style={[styles.highlightDot, styles.dotGreen]} />
                <Text style={styles.highlightText}>Stay financially focused</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Sign in</Text>
              <Text style={styles.cardSubtitle}>
                Enter your account details to continue.
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputShell}>
                <View style={styles.inputIconCircle}>
                  <Text style={styles.inputIcon}>@</Text>
                </View>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#6B5A1A"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
              </View>
              <View style={styles.inputShell}>
                <View style={styles.inputIconCircle}>
                  <Text style={styles.inputIcon}>•</Text>
                </View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#6B5A1A"
                  secureTextEntry={!showPassword}
                  textContentType="password"
                  style={styles.input}
                />
                <Pressable
                  onPress={() => setShowPassword((value) => !value)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <View style={styles.errorIcon}>
                  <Text style={styles.errorIconText}>!</Text>
                </View>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={loading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.loginButton,
                loading && styles.loginButtonDisabled,
                pressed && !loading && styles.loginButtonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#F4C400" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign in</Text>
                  <Text style={styles.loginButtonArrow}>→</Text>
                </>
              )}
            </Pressable>

            <View style={styles.securityRow}>
              <View style={styles.securityIcon}>
                <Text style={styles.securityIconText}>✓</Text>
              </View>
              <Text style={styles.securityText}>
                Your financial information is kept secure.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footerText}>PERSONAL FINANCE MANAGER {`\n`}              VERSION 1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFD83D',
  },

  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    position: 'relative',
    overflow: 'hidden',
  },

  scrollContentCompact: {
    paddingHorizontal: 18,
    paddingVertical: 28,
  },

  backgroundShapeTop: {
    position: 'absolute',
    width: 430,
    height: 430,
    borderRadius: 215,
    backgroundColor: '#FFE9A3',
    top: -230,
    right: -150,
  },

  backgroundShapeBottom: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#E7F2A8',
    bottom: -220,
    left: -170,
  },

  layout: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 28,
  },

  layoutCompact: {
    flexDirection: 'column',
    gap: 18,
  },

  brandPanel: {
    flex: 1,
    minHeight: 560,
    borderRadius: 28,
    backgroundColor: '#171A24',
    paddingHorizontal: 42,
    paddingVertical: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2E3A',
    shadowColor: '#171A24',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
    elevation: 8,
  },

  brandPanelCompact: {
    minHeight: 0,
    paddingHorizontal: 28,
    paddingVertical: 30,
    alignItems: 'center',
  },

  logoHalo: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: '#F4C400',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 10,
    borderColor: '#FFD43B',
    shadowColor: '#F4C400',
    shadowOffset: { width: 18, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 4,
  },

  logo: {
    width: 88,
    height: 88,
  },

  brandEyebrow: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: '#F4C400',
    marginBottom: 10,
  },

  brandTitle: {
    fontSize: 35,
    lineHeight: 42,
    fontWeight: '800',
    color: '#FFF7D6',
    marginBottom: 16,
  },

  brandDescription: {
    maxWidth: 430,
    fontSize: 16,
    lineHeight: 23,
    color: '#FFF4B8',
  },

  brandHighlights: {
    marginTop: 34,
    gap: 14,
  },

  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  highlightDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  dotBlue: {
    backgroundColor: '#F4C400',
  },

  dotGold: {
    backgroundColor: '#F4C400',
  },

  dotGreen: {
    backgroundColor: '#43D29D',
  },

  highlightText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF4B8',
  },

  card: {
    flex: 0.82,
    minHeight: 560,
    backgroundColor: '#FFF0A8',
    borderRadius: 28,
    paddingHorizontal: 38,
    paddingVertical: 40,
    borderWidth: 1,
    borderColor: '#E7C33A',
    justifyContent: 'center',
    shadowColor: '#171A24',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.13,
    shadowRadius: 28,
    elevation: 5,
  },

  cardHeader: {
    marginBottom: 28,
  },

  cardTitle: {
    fontSize: 35,
    lineHeight: 36,
    fontWeight: '800',
    color: '#171A24',
  },

  cardSubtitle: {
    marginTop: 7,
    fontSize: 17,
    lineHeight: 21,
    color: '#4D5566',
  },

  fieldGroup: {
    marginBottom: 18,
  },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  label: {
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#3D3210',
  },

  inputShell: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D5AA00',
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFF9D6',
  },

  inputIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0A8',
    marginRight: 10,
  },

  inputIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#A66B00',
  },

  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 2,
    fontSize: 18,
    color: '#171A24',
  },

  passwordToggle: {
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  passwordToggleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#A66B00',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FCE4E4',
    borderWidth: 1,
    borderColor: '#F0AAAA',
  },

  errorIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D93636',
    marginRight: 9,
  },

  errorIconText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFF7D6',
  },

  errorText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 18,
    color: '#B52D2D',
  },

  loginButton: {
    height: 54,
    borderRadius: 14,
    marginTop: 20,
    backgroundColor: '#171A24',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#171A24',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  loginButtonText: {
    color: '#F4C400',
    fontSize: 18,
    fontWeight: '800',
  },

  loginButtonArrow: {
    marginLeft: 10,
    color: '#F4C400',
    fontSize: 25,
    fontWeight: '500',
    lineHeight: 22,
  },

  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#E7C33A',
  },

  securityIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2F6EC',
    marginRight: 8,
  },

  securityIconText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#159A68',
  },

  securityText: {
    fontSize: 13,
    color: '#4D5566',
  },

  pressed: {
    opacity: 0.7,
  },

  footerText: {
    alignSelf: 'center',
    marginTop: 22,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#6B5A1A',
  },
});

