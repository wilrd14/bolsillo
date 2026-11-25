import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { es } from '@/core/strings/es';
import { createDatabaseClient } from '@/db/client';
import type { Database } from '@/db/database';
import { ensureDefaultCategories } from '@/db/seed-categories';
import { useTheme } from '@/ui/use-theme';

const DatabaseContext = createContext<Database | null>(null);
const getDatabase = createDatabaseClient(openDatabaseAsync);

/** Base de datos lista (migrada y con categorías sembradas) para las pantallas. */
export function useDatabase(): Database {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDatabase requires DatabaseProvider');
  return db;
}

/** Abre SQLite, aplica migraciones y siembra categorías antes de mostrar la app. */
export function DatabaseProvider({ children }: { readonly children: ReactNode }) {
  const theme = useTheme();
  const [db, setDb] = useState<Database | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then(async (opened) => {
        await ensureDefaultCategories(opened);
        if (active) setDb(opened);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (!db) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        {failed ? (
          <Text
            accessibilityRole="alert"
            style={[theme.typography.body, { color: theme.colors.text }]}
          >
            {es.recoverableError}
          </Text>
        ) : (
          <ActivityIndicator accessibilityLabel={es.loading} color={theme.colors.primary} />
        )}
      </View>
    );
  }
  return <DatabaseContext.Provider value={db}>{children}</DatabaseContext.Provider>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
