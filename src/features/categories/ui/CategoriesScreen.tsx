import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { es } from '@/core/strings/es';
import type { CategoryRow } from '@/features/categories';
import {
  COLOR_OPTIONS,
  EMPTY_DRAFT,
  ICON_OPTIONS,
  useCategories,
  type CategoryDraft,
} from '@/features/categories/model/use-categories';
import { Banner, Button, ConfirmDialog, EmptyState, MIN_TOUCH_TARGET, useTheme } from '@/ui';

const KINDS = [
  { value: 'expense', label: es.capture.kindExpense },
  { value: 'income', label: es.capture.kindIncome },
] as const;

type IconName = keyof typeof Ionicons.glyphMap;

/** Pantalla de categorías (Brief §12.8): lista por tipo, alta/edición en modal y archivado. */
export function CategoriesScreen() {
  const { colors, spacing, radii, typography } = useTheme();
  const vm = useCategories();
  const insets = useSafeAreaInsets();
  // editing: null = cerrado, 'new' = alta, CategoryRow = edición.
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(EMPTY_DRAFT);
  const [nameError, setNameError] = useState(false);
  const [toArchive, setToArchive] = useState<CategoryRow | null>(null);

  const openForm = (target: CategoryRow | 'new') => {
    setDraft(
      target === 'new'
        ? EMPTY_DRAFT
        : {
            name: target.name,
            icon: target.icon ?? EMPTY_DRAFT.icon,
            color: target.color ?? EMPTY_DRAFT.color,
          },
    );
    setNameError(false);
    setEditing(target);
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setNameError(true);
      return;
    }
    const ok =
      editing === 'new' || editing === null
        ? await vm.create(draft)
        : await vm.update(editing.id, draft);
    if (ok) setEditing(null);
  };

  const confirmArchive = async () => {
    const target = toArchive;
    setToArchive(null);
    if (target) await vm.archive(target.id);
  };

  const body = () => {
    if (vm.status === 'loading') {
      return (
        <Text
          style={[typography.body, styles.center, { color: colors.textMuted, padding: spacing.xl }]}
        >
          {es.loading}
        </Text>
      );
    }
    if (vm.status === 'error') {
      return (
        <View style={{ padding: spacing.lg }}>
          <Banner
            message={es.recoverableError}
            variant="error"
            actionLabel={es.actions.retry}
            onAction={vm.retry}
          />
        </View>
      );
    }
    return (
      <FlatList
        data={vm.items}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<EmptyState title={es.categories.empty} />}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { borderBottomColor: colors.border, paddingHorizontal: spacing.lg },
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: item.color ?? colors.primary }]}>
              <Ionicons
                name={(item.icon ?? 'ellipsis-horizontal') as IconName}
                size={20}
                color="#FFFFFF"
              />
            </View>
            <Text style={[typography.body, styles.flex, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Pressable
              onPress={() => openForm(item)}
              accessibilityRole="button"
              accessibilityLabel={`${es.categories.edit}: ${item.name}`}
              style={styles.action}
            >
              <Text style={[typography.label, { color: colors.primary }]}>
                {es.categories.edit}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setToArchive(item)}
              accessibilityRole="button"
              accessibilityLabel={`${es.categories.archive}: ${item.name}`}
              style={styles.action}
            >
              <Text style={[typography.label, { color: colors.danger }]}>
                {es.categories.archive}
              </Text>
            </Pressable>
          </View>
        )}
      />
    );
  };

  const field: ViewStyle = {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={es.categories.kindSwitch}
        style={[styles.kinds, { padding: spacing.lg }]}
      >
        {KINDS.map((item) => {
          const selected = vm.kind === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => vm.setKind(item.value)}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              style={[
                styles.kind,
                {
                  borderRadius: radii.pill,
                  backgroundColor: selected ? colors.primary : colors.surfaceAlt,
                },
              ]}
            >
              <Text style={[typography.body, { color: selected ? colors.onPrimary : colors.text }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.flex}>{body()}</View>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }}>
        <Button label={es.categories.newCategory} onPress={() => openForm('new')} />
      </View>

      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <KeyboardAvoidingView
          style={[styles.flex, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: spacing.lg,
              paddingTop: spacing.lg + insets.top,
              paddingBottom: spacing.lg + insets.bottom,
              gap: spacing.md,
            }}
          >
            <Text accessibilityRole="header" style={[typography.title1, { color: colors.text }]}>
              {editing === 'new' ? es.categories.newCategory : es.categories.editCategory}
            </Text>
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder={es.categories.name}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={es.categories.name}
              maxLength={40}
              style={[typography.body, field, { color: colors.text }]}
            />
            {nameError ? (
              <Text accessibilityRole="alert" style={[typography.label, { color: colors.danger }]}>
                {es.categories.nameRequired}
              </Text>
            ) : null}
            <Text style={[typography.label, { color: colors.textMuted }]}>
              {es.categories.icon}
            </Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {ICON_OPTIONS.map((icon) => {
                const selected = draft.icon === icon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => setDraft((d) => ({ ...d, icon }))}
                    accessibilityRole="radio"
                    accessibilityLabel={`${es.categories.icon} ${icon}`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.option,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        borderWidth: selected ? 2 : 1,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  >
                    <Ionicons name={icon as IconName} size={22} color={colors.text} />
                  </Pressable>
                );
              })}
            </View>
            <Text style={[typography.label, { color: colors.textMuted }]}>
              {es.categories.color}
            </Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {COLOR_OPTIONS.map((color) => {
                const selected = draft.color === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => setDraft((d) => ({ ...d, color }))}
                    accessibilityRole="radio"
                    accessibilityLabel={`${es.categories.color} ${color}`}
                    accessibilityState={{ selected }}
                    style={[
                      styles.option,
                      {
                        backgroundColor: color,
                        borderColor: colors.text,
                        borderWidth: selected ? 3 : 0,
                      },
                    ]}
                  >
                    {selected ? <Ionicons name="checkmark" size={22} color="#FFFFFF" /> : null}
                  </Pressable>
                );
              })}
            </View>
            {vm.saveError ? <Banner message={es.recoverableError} variant="error" /> : null}
            <Button label={es.actions.save} onPress={() => void submit()} />
            <Button label={es.categories.cancel} variant="text" onPress={() => setEditing(null)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={toArchive !== null}
        title={es.categories.archiveTitle}
        message={es.categories.archiveMessage}
        confirmLabel={es.categories.archive}
        cancelLabel={es.categories.cancel}
        variant="destructive"
        onConfirm={() => void confirmArchive()}
        onCancel={() => setToArchive(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: { flex: 1, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
