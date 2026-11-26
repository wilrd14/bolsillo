import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { es } from '@/core/strings/es';
import { useSummary, type ReportPeriod } from '@/features/reports/model/use-report';
import { CategoryBars, SectionHeader, StatTile } from '@/features/reports/ui/ReportParts';
import { Banner, Button, MIN_TOUCH_TARGET, useTheme } from '@/ui';

const PERIODS: readonly { value: ReportPeriod; label: string }[] = [
  { value: 'week', label: es.summary.week },
  { value: 'month', label: es.summary.month },
];

/** Resumen ampliado (Brief §12.7): selector semana/mes, totales y desglose por categoría. */
export function SummaryScreen() {
  const { colors, spacing, radii, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const vm = useSummary();
  const { refresh } = vm;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const body = () => {
    if (vm.status === 'error') {
      return (
        <Banner
          message={es.recoverableError}
          variant="error"
          actionLabel={es.actions.retry}
          onAction={vm.retry}
        />
      );
    }
    if (vm.status === 'loading' || !vm.report) {
      return (
        <Text style={[typography.body, styles.center, { color: colors.textMuted }]}>
          {es.loading}
        </Text>
      );
    }
    const { report } = vm;
    const empty = report.breakdown.length === 0;
    return (
      <>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <StatTile
            title={es.home.expense}
            amountMinor={report.expense_minor}
            color={colors.expense}
            sign="-"
          />
          <StatTile
            title={es.home.income}
            amountMinor={report.income_minor}
            color={colors.income}
            sign="+"
          />
        </View>
        <View style={styles.row}>
          <StatTile
            title={es.summary.balance}
            amountMinor={report.balance_minor}
            color={report.balance_minor < 0 ? colors.expense : colors.income}
            sign={report.balance_minor < 0 ? '-' : ''}
          />
        </View>
        <SectionHeader title={es.summary.byCategory} />
        {empty || vm.shares.length === 0 ? (
          <Text style={[typography.secondary, { color: colors.textMuted }]}>
            {es.summary.empty}
          </Text>
        ) : (
          <CategoryBars shares={vm.shares} />
        )}
      </>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
        gap: spacing.lg,
      }}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={es.summary.periodSelector}
        style={[styles.row, { gap: spacing.sm }]}
      >
        {PERIODS.map((item) => {
          const selected = vm.period === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => vm.setPeriod(item.value)}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              style={[
                styles.segment,
                {
                  borderRadius: radii.pill,
                  backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                },
              ]}
            >
              <Text
                style={[
                  typography.bodyMedium,
                  { color: selected ? colors.onPrimary : colors.text },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.row, styles.nav, { gap: spacing.sm }]}>
        <Button
          label="‹"
          variant="secondary"
          onPress={() => vm.shift(-1)}
          accessibilityLabel={es.summary.previousPeriod}
        />
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[typography.bodyMedium, styles.label, { color: colors.text }]}
        >
          {vm.label}
        </Text>
        <Button
          label="›"
          variant="secondary"
          onPress={() => vm.shift(1)}
          accessibilityLabel={es.summary.nextPeriod}
        />
      </View>
      {body()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  nav: { alignItems: 'center' },
  label: { flex: 1, textAlign: 'center' },
  center: { textAlign: 'center', padding: 24 },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
