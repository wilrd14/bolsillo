import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDisplayDate, toLocalDateKey } from '@/core/dates';
import { es } from '@/core/strings/es';
import { Banner, Button, ConfirmDialog, EmptyState, useTheme } from '@/ui';

import { useAccount } from '../model/account-provider';
import { AuthForm } from './AuthForm';

function formatSyncTime(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${formatDisplayDate(toLocalDateKey(date))} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Cuenta y sincronización (Brief §12.9). El título lo pone el encabezado nativo. */
export function AccountScreen() {
  const { colors, spacing, typography, cardElevation, radii } = useTheme();
  const account = useAccount();
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<'delete' | 'wipe' | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    setFailure(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setFailure(result.message ?? es.recoverableError);
  };

  const body = () => {
    if (!account.available) {
      return <EmptyState title={es.account.unavailable} description={es.account.unavailableHint} />;
    }
    if (account.restoring) {
      return (
        <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>
          {es.loading}
        </Text>
      );
    }
    if (account.status === 'error') {
      return (
        <Banner
          message={es.recoverableError}
          variant="error"
          actionLabel={es.actions.retry}
          onAction={account.retryRestore}
        />
      );
    }
    if (account.status !== 'signedIn') return <AuthForm />;

    const { sync } = account;
    const syncText =
      sync.state === 'syncing'
        ? es.account.syncing
        : sync.state === 'synced' && sync.lastSyncedAt !== null
          ? es.account.synced(formatSyncTime(sync.lastSyncedAt))
          : sync.state === 'error'
            ? es.account.syncError
            : es.account.syncIdle;

    return (
      <View style={{ gap: spacing.lg }}>
        {failure ? <Banner message={failure} variant="error" /> : null}
        {account.conflict ? (
          <View style={{ gap: spacing.sm }}>
            <Banner
              message={`${es.account.conflictTitle}. ${es.account.conflictMessage}`}
              variant="warning"
            />
            <Button
              label={es.account.conflictWipe}
              variant="secondary"
              disabled={busy}
              onPress={() => setDialog('wipe')}
            />
          </View>
        ) : null}
        <View
          style={[
            cardElevation,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.card,
              padding: spacing.lg,
              gap: spacing.xs,
            },
          ]}
        >
          <Text style={[typography.label, { color: colors.textMuted }]}>
            {es.account.signedInAs}
          </Text>
          <Text accessibilityRole="header" style={[typography.title2, { color: colors.text }]}>
            {account.email}
          </Text>
        </View>
        <View
          style={[
            cardElevation,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.card,
              padding: spacing.lg,
              gap: spacing.sm,
            },
          ]}
        >
          <Text style={[typography.title2, { color: colors.text }]}>{es.account.syncTitle}</Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[
              typography.body,
              { color: sync.state === 'error' ? colors.danger : colors.textMuted },
            ]}
          >
            {syncText}
          </Text>
          <Button
            label={es.account.syncNow}
            loading={sync.state === 'syncing'}
            disabled={busy || account.conflict}
            onPress={() => void account.syncNow()}
          />
        </View>
        <Button
          label={es.account.logout}
          variant="secondary"
          accessibilityHint={es.account.logoutHint}
          disabled={busy}
          onPress={() => void run(account.signOut)}
        />
        <Button
          label={es.account.deleteAccount}
          variant="danger"
          disabled={busy}
          onPress={() => setDialog('delete')}
        />
        <ConfirmDialog
          visible={dialog === 'delete'}
          variant="destructive"
          title={es.account.deleteTitle}
          message={es.account.deleteMessage}
          confirmLabel={es.account.deleteConfirm}
          cancelLabel={es.actions.cancel}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void run(account.deleteAccount);
          }}
        />
        <ConfirmDialog
          visible={dialog === 'wipe'}
          variant="destructive"
          title={es.account.wipeTitle}
          message={es.account.wipeMessage}
          confirmLabel={es.account.wipeConfirm}
          cancelLabel={es.actions.cancel}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void run(account.wipeAndContinue);
          }}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.xl + insets.bottom,
        }}
      >
        {body()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
