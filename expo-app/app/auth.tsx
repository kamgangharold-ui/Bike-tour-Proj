import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../src/firebase/config';

function firebaseErrorMessage(e: unknown, t: TFunction): string {
  const code = (e as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/network-request-failed': t('auth.errorNetwork'),
    'auth/too-many-requests': t('auth.errorTooManyRequests'),
    'auth/invalid-api-key': t('auth.errorConfig'),
    'auth/email-already-in-use': t('auth.errorEmailInUse'),
    'auth/wrong-password': t('auth.errorWrongPassword'),
    'auth/invalid-credential': t('auth.errorWrongPassword'),
    'auth/user-not-found': t('auth.errorUserNotFound'),
    'auth/weak-password': t('auth.errorWeakPassword'),
  };
  return map[code] ?? (e instanceof Error ? e.message : t('auth.errorGeneric'));
}

export default function AuthScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuest = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAnonymously(auth);
      router.replace('/(tabs)/map');
    } catch (e: unknown) {
      setError(firebaseErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('auth.errorEnterCredentials'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      router.replace('/(tabs)/map');
    } catch (e: unknown) {
      setError(firebaseErrorMessage(e, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🚴</Text>
        <Text style={styles.title}>{t('auth.appTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.appSubtitle')}</Text>

        <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.guestBtnText}>{t('auth.exploreAsGuest')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.orSignInWithEmail')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor="#666"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error.length > 0 && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.emailBtn} onPress={handleEmail} disabled={loading}>
          <Text style={styles.emailBtnText}>{isSignUp ? t('auth.signUp') : t('auth.signIn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp((v) => !v)} style={styles.toggleRow}>
          <Text style={styles.toggleText}>
            {isSignUp ? t('auth.toggleToSignIn') : t('auth.toggleToSignUp')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 52, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#00C853',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 36,
  },
  guestBtn: {
    backgroundColor: '#00C853',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  guestBtnText: { fontSize: 16, fontWeight: '700', color: '#000' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
  dividerText: { fontSize: 12, color: '#666' },
  input: {
    backgroundColor: '#2C2C2C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 12,
  },
  error: {
    color: '#EF5350',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  emailBtn: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00C853',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  emailBtnText: { fontSize: 15, fontWeight: '600', color: '#00C853' },
  toggleRow: { alignItems: 'center' },
  toggleText: { fontSize: 13, color: '#666' },
});
