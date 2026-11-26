import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { DEFAULT_CURRENCY, LOCALE, useHome } from '@/features/reports/model/use-report';
import { CategoryBars, SectionHeader, StatTile } from '@/features/reports/ui/ReportParts';
import { Banner, CAPTURE_BUTTON_SIZE, EmptyState, TransactionRow, useTheme } from '@/ui';

/** Pantalla Inicio (Brief §12.1): balance del mes, principales gastos y últimos movimientos. */
export function HomeScreen() {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  const insets = useSafeAreaInsets();
  // Alto de la barra de pestañas (app/(tabs)/_layout.tsx): minHeight del botón de captura + sm.
  const tabBarHeight = CAPTURE_BUTTON_SIZE + spacing.sm;
  const vm = useHome();
  const { refresh } = vm;

  // Un movimiento nuevo o editado aparece al volver a esta pestaña, sin recargar.
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
    if (vm.latest.length === 0) {
      return (
        <EmptyState
          title={es.home.emptyTitle}
          description={es.home.emptyDescription}
          actionLabel={es.home.emptyAction}
          onAction={() => router.push('/capture')}
        />
      );
    }
    const { report } = vm;
    return (
      <>
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={`${es.home.netBalance}: ${formatMoney(report.balance_minor, DEFAULT_CURRENCY, LOCALE)}`}
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
          <Text style={[typography.secondary, { color: colors.textMuted }]}>
            {es.home.netBalance}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            style={[typography.amountLarge, { color: colors.text }]}
          >
            {formatMoney(report.balance_minor, DEFAULT_CURRENCY, LOCALE)}
          </Text>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <StatTile
              title={es.home.income}
              amountMinor={report.income_minor}
              color={colors.income}
              sign="+"
            />
            <StatTile
              title={es.home.expense}
              amountMinor={report.expense_minor}
              color={colors.expense}
              sign="-"
            />
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title={es.home.topExpenses}
            linkLabel={es.home.viewDetail}
            onLink={() => router.push('/summary')}
          />
          {vm.topShares.length > 0 ? (
            <CategoryBars shares={vm.topShares} />
          ) : (
            <Text style={[typography.secondary, { color: colors.textMuted }]}>
              {es.home.noExpenses}
            </Text>
          )}
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionHeader
            title={es.home.latest}
            linkLabel={es.home.viewAll}
            onLink={() => router.navigate('/transactions')}
          />
          <View
            style={[
              cardElevation,
              { backgroundColor: colors.surface, borderRadius: radii.card, overflow: 'hidden' },
            ]}
          >
            {vm.latest.map((item) => (
              <TransactionRow
                key={item.id}
                title={item.title}
                subtitle={item.categoryName}
                dateLabel={item.dateLabel}
                amountMinor={item.amountMinor}
                currency={item.currency}
                kind={item.kind}
                categoryColor={item.categoryColor ?? colors.primary}
                onPress={() =>
                  router.push({ pathname: '/transaction/[id]', params: { id: item.id } })
                }
              />
            ))}
          </View>
        </View>
      </>
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingHorizontal: spacing.lg,
        paddingBottom: tabBarHeight + insets.bottom + spacing.lg,
        gap: spacing.lg,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text
          accessibilityLabel={`${es.home.monthSelector}: ${vm.monthLabel}`}
          style={[typography.secondaryMedium, { color: colors.textMuted }]}
        >
          {vm.monthLabel.charAt(0).toUpperCase() + vm.monthLabel.slice(1)}
        </Text>
        <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
          {es.home.greeting}
        </Text>
      </View>
      {body()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  center: { textAlign: 'center', padding: 24 },
});
