import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { es } from '@/core/strings/es';
import { Banner, Button, MIN_TOUCH_TARGET, useTheme } from '@/ui';

import { validateCredentials, type AuthMode, type CredentialErrors } from '../model/credentials';
import { useAccount } from '../model/account-provider';

/** Formularios de inicio y de registro con correo y contraseña (los términos llegarán en T-038). */
export function AuthForm() {
  const { colors, spacing, radii, typography } = useTheme();
  const account = useAccount();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<CredentialErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  const submit = async () => {
    const found = validateCredentials(mode, { email, password });
    setErrors(found);
    setFailure(null);
    setNotice(null);
    if (found.email || found.password) return;
    setBusy(true);
    const result = await (register ? account.signUp : account.signIn)(email, password);
    setBusy(false);
    if (!result.ok) setFailure(result.message);
    else if (result.needsConfirmation) {
      setNotice(es.account.confirmEmail);
      setMode('login');
    }
  };

  const field = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
        {register ? es.account.registerTitle : es.account.loginTitle}
      </Text>
      <Text style={[typography.body, { color: colors.textMuted }]}>{es.account.intro}</Text>
      {notice ? <Banner message={notice} variant="info" /> : null}
      {failure ? <Banner message={failure} variant="error" /> : null}

      <Text style={[typography.label, { color: colors.textMuted }]}>{es.account.email}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={es.account.email}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={es.account.email}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
        style={[typography.body, field]}
      />
      {errors.email ? (
        <Text accessibilityRole="alert" style={[typography.label, { color: colors.danger }]}>
          {errors.email}
        </Text>
      ) : null}

      <Text style={[typography.label, { color: colors.textMuted }]}>{es.account.password}</Text>
      <View style={[styles.passwordRow, { gap: spacing.sm }]}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={es.account.password}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={es.account.password}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={register ? 'new-password' : 'current-password'}
          textContentType={register ? 'newPassword' : 'password'}
          editable={!busy}
          style={[typography.body, field, styles.passwordInput]}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? es.account.hidePassword : es.account.showPassword}
          style={styles.toggle}
        >
          <Text style={[typography.secondaryMedium, { color: colors.primary }]}>
            {visible ? es.account.hidePassword : es.account.showPassword}
          </Text>
        </Pressable>
      </View>
      {errors.password ? (
        <Text accessibilityRole="alert" style={[typography.label, { color: colors.danger }]}>
          {errors.password}
        </Text>
      ) : null}

      <Button
        label={register ? es.account.register : es.account.login}
        onPress={() => void submit()}
        loading={busy}
        style={{ marginTop: spacing.sm }}
      />
      <Button
        label={register ? es.account.toLogin : es.account.toRegister}
        variant="text"
        disabled={busy}
        onPress={() => {
          setMode(register ? 'login' : 'register');
          setErrors({});
          setFailure(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  toggle: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
