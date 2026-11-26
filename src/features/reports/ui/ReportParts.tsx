import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/core/money';
import { es } from '@/core/strings/es';
import { DEFAULT_CURRENCY, LOCALE, type CategoryShare } from '@/features/reports/model/use-report';
import { MIN_TOUCH_TARGET, useTheme } from '@/ui';

/** Tarjeta de cifra con ancho flexible: el importe se encoge antes de salirse de la pantalla. */
export function StatTile({
  title,
  amountMinor,
  color,
  sign,
}: {
  readonly title: string;
  readonly amountMinor: number;
  readonly color: string;
  readonly sign: string;
}) {
  const { colors, spacing, radii, typography } = useTheme();
  const text = `${sign}${formatMoney(Math.abs(amountMinor), DEFAULT_CURRENCY, LOCALE)}`;
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}: ${text}`}
      style={[
        styles.tile,
        { backgroundColor: colors.surfaceAlt, borderRadius: radii.card, padding: spacing.md },
      ]}
    >
      <Text numberOfLines={1} style={[typography.secondaryMedium, { color: colors.textMuted }]}>
        {title}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[typography.title2, { color }]}
      >
        {text}
      </Text>
    </View>
  );
}

/** Título de sección con enlace opcional a la derecha. */
export function SectionHeader({
  title,
  linkLabel,
  onLink,
}: {
  readonly title: string;
  readonly linkLabel?: string;
  readonly onLink?: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={[styles.sectionRow, { gap: spacing.sm }]}>
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={[typography.title2, styles.shrink, { color: colors.text }]}
      >
        {title}
      </Text>
      {linkLabel && onLink ? (
        <Pressable
          onPress={onLink}
          accessibilityRole="link"
          accessibilityLabel={linkLabel}
          style={styles.link}
        >
          <Text style={[typography.bodyMedium, { color: colors.primary }]}>{linkLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Desglose por categoría: cada fila es a la vez la barra y su equivalente accesible
 * (nombre, importe y porcentaje en la etiqueta); la barra se oculta al lector de pantalla.
 */
export function CategoryBars({ shares }: { readonly shares: readonly CategoryShare[] }) {
  const { colors, spacing, radii, typography, cardElevation } = useTheme();
  return (
    <View
      accessibilityRole="list"
      accessibilityLabel={es.summary.categoryList}
      style={[
        cardElevation,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.card,
          padding: spacing.lg,
          gap: spacing.lg,
        },
      ]}
    >
      {shares.map((share) => {
        const amount = formatMoney(share.amountMinor, DEFAULT_CURRENCY, LOCALE);
        return (
          <View
            key={share.id}
            accessible
            accessibilityLabel={es.summary.row(share.name, amount, share.percent)}
            style={{ gap: spacing.sm }}
          >
            <View style={[styles.sectionRow, { gap: spacing.sm }]}>
              <Text
                numberOfLines={1}
                style={[typography.bodyMedium, styles.shrink, { color: colors.text }]}
              >
                {share.name}
              </Text>
              <Text numberOfLines={1} style={[typography.bodyMedium, { color: colors.text }]}>
                {amount}
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.secondary, styles.percent, { color: colors.textMuted }]}
              >
                {`${share.percent} %`}
              </Text>
            </View>
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(share.percent, 2)}%`,
                    backgroundColor: share.color ?? colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, gap: 4 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shrink: { flexShrink: 1, flex: 1 },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  percent: { minWidth: 44, textAlign: 'right' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
