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
            <Text style={styles.brandTitle}>Personal Finance{`\n`}Manager</Text>
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
                  placeholderTextColor="#94A3B8"
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
                  <Text style={styles.inputIcon}>â€¢</Text>
                </View>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign in</Text>
                  <Text style={styles.loginButtonArrow}>â†’</Text>
                </>
              )}
            </Pressable>

            <View style={styles.securityRow}>
              <View style={styles.securityIcon}>
                <Text style={styles.securityIconText}>âœ“</Text>
              </View>
              <Text style={styles.securityText}>
                Your financial information is kept secure.
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footerText}>PERSONAL FINANCE MANAGER</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
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
    backgroundColor: '#EAF1FF',
    top: -230,
    right: -150,
  },

  backgroundShapeBottom: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: '#E8F7F1',
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
    backgroundColor: '#0B3A82',
    paddingHorizontal: 42,
    paddingVertical: 42,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0B3A82',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 7,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },

  logo: {
    width: 88,
    height: 88,
  },

  brandEyebrow: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: '#FFC107',
    marginBottom: 10,
  },

  brandTitle: {
    fontSize: 42,
    lineHeight: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },

  brandDescription: {
    maxWidth: 430,
    fontSize: 18,
    lineHeight: 23,
    color: '#DCE9FF',
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
    backgroundColor: '#7DB5FF',
  },

  dotGold: {
    backgroundColor: '#FFC107',
  },

  dotGreen: {
    backgroundColor: '#58D7A7',
  },

  highlightText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#EAF2FF',
  },

  card: {
    flex: 0.82,
    minHeight: 560,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 38,
    paddingVertical: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
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
    color: '#0F172A',
  },

  cardSubtitle: {
    marginTop: 7,
    fontSize: 17,
    lineHeight: 21,
    color: '#64748B',
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
    color: '#334155',
  },

  inputShell: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },

  inputIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
    marginRight: 10,
  },

  inputIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#356DFF',
  },

  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 2,
    fontSize: 18,
    color: '#0F172A',
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
    color: '#356DFF',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },

  errorIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    marginRight: 9,
  },

  errorIconText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  errorText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 18,
    color: '#B91C1C',
  },

  loginButton: {
    height: 54,
    borderRadius: 14,
    marginTop: 20,
    backgroundColor: '#007BFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    shadowColor: '#007BFF',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },

  loginButtonArrow: {
    marginLeft: 10,
    color: '#FFFFFF',
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
    borderTopColor: '#EEF2F7',
  },

  securityIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F8F1',
    marginRight: 8,
  },

  securityIconText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#18A673',
  },

  securityText: {
    fontSize: 13,
    color: '#64748B',
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
    color: '#94A3B8',
  },
});

