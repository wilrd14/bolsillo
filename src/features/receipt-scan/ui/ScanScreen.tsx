import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDisplayDate, toLocalDateKey } from '@/core/dates';
import { es } from '@/core/strings/es';
import { RequireAccountNotice } from '@/features/account';
import { Banner, Button, ConfirmDialog, MIN_TOUCH_TARGET, useTheme } from '@/ui';

import { failureMessage, useScan } from '../model/use-scan';

function openReview(id: string) {
  router.push({ pathname: '/receipt-review', params: { id } });
}

/** Pantalla de escaneo (Brief §12.3): guía, cámara, galería, estados y escaneos pendientes. */
export function ScanScreen() {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();
  const vm = useScan();
  const [discarding, setDiscarding] = useState<string | null>(null);
  const { reload } = vm;

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const run = async (source: 'camera' | 'library') => {
    const id = await vm.scan(source);
    if (id) openReview(id);
  };
  const card = [
    cardElevation,
    { backgroundColor: colors.surface, borderRadius: radii.card, padding: spacing.lg },
  ];

  if (vm.access === 'checking') {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <Text accessibilityRole="text" style={[typography.body, { color: colors.textMuted }]}>
          {es.loading}
        </Text>
      </View>
    );
  }

  if (vm.access === 'needsAccount') {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, padding: spacing.lg }]}>
        <RequireAccountNotice />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.lg + insets.bottom,
          gap: spacing.md,
        }}
      >
        <View style={[card, { gap: spacing.md }]}>
          {vm.noPermission ? (
            <Text accessibilityRole="header" style={[typography.title2, { color: colors.text }]}>
              {es.scan.permissionTitle}
            </Text>
          ) : null}
          <Text style={[typography.body, { color: colors.textMuted }]}>
            {vm.noPermission ? es.cameraPermission : es.scan.guide}
          </Text>
          {vm.processing ? (
            <Banner message={es.scanning} variant="info" />
          ) : (
            <>
              {vm.noPermission ? null : (
                <Button label={es.scan.takePhoto} onPress={() => void run('camera')} />
              )}
              <Button
                label={es.scan.pickPhoto}
                variant={vm.noPermission ? 'primary' : 'secondary'}
                onPress={() => void run('library')}
              />
            </>
          )}
        </View>

        {vm.notice ? (
          <Banner
            message={vm.notice.message}
            variant={vm.notice.variant}
            actionLabel={es.actions.accept}
            onAction={vm.dismissNotice}
          />
        ) : null}

        <Text
          accessibilityRole="header"
          style={[typography.label, { color: colors.textMuted, marginTop: spacing.sm }]}
        >
          {es.scan.pendingTitle.toUpperCase()}
        </Text>
        {vm.inboxStatus === 'loading' ? (
          <Text
            accessibilityRole="text"
            style={[typography.secondary, { color: colors.textMuted }]}
          >
            {es.loading}
          </Text>
        ) : vm.inboxStatus === 'error' ? (
          <Banner
            message={es.recoverableError}
            variant="error"
            actionLabel={es.actions.retry}
            onAction={() => void reload()}
          />
        ) : vm.inbox.length === 0 ? (
          <Text
            accessibilityRole="text"
            style={[typography.secondary, { color: colors.textMuted }]}
          >
            {es.scan.pendingEmpty}
          </Text>
        ) : (
          vm.inbox.map((item) => {
            const date = formatDisplayDate(toLocalDateKey(new Date(item.created_at)));
            const title = es.scan.pendingFrom(date);
            const detail =
              item.status === 'done'
                ? null
                : item.status === 'failed'
                  ? `${es.scan.failedItem}. ${failureMessage(item.error_code)}`
                  : item.status === 'processing'
                    ? es.scan.processing
                    : es.pendingScan;
            return (
              <View key={item.id} style={[card, { gap: spacing.sm }]}>
                <Text style={[typography.bodyMedium, { color: colors.text }]}>{title}</Text>
                {detail ? (
                  <Text style={[typography.secondary, { color: colors.textMuted }]}>{detail}</Text>
                ) : null}
                <View style={[styles.row, { gap: spacing.sm }]}>
                  {item.status === 'done' ? (
                    <Button
                      label={es.scan.review}
                      accessibilityLabel={`${es.scan.review}: ${title}`}
                      onPress={() => openReview(item.id)}
                      style={styles.flex}
                    />
                  ) : null}
                  {item.status === 'processing' ? null : (
                    <Button
                      label={es.scan.discard}
                      accessibilityLabel={`${es.scan.discard}: ${title}`}
                      variant="secondary"
                      onPress={() => setDiscarding(item.id)}
                      style={styles.flex}
                    />
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      <ConfirmDialog
        visible={discarding !== null}
        title={es.scan.discardTitle}
        message={es.scan.discardMessage}
        confirmLabel={es.scan.discard}
        cancelLabel={es.scan.keep}
        variant="destructive"
        onCancel={() => setDiscarding(null)}
        onConfirm={() => {
          const id = discarding;
          setDiscarding(null);
          if (id) void vm.discard(id);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minHeight: MIN_TOUCH_TARGET },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
});
