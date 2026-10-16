import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DATABASE_NAME } from "@/db/schema";
import { migrate, seedDefaultCategories } from "@/db/schema";
import { ThemeProvider } from "@/theme/ThemeContext";
import { AppProvider } from "@/store/AppContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider
        databaseName={DATABASE_NAME}
        onInit={async (db) => {
          await migrate(db);
          await seedDefaultCategories(db);
        }}
      >
        <ThemeProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppGate />
          </GestureHandlerRootView>
        </ThemeProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { Btn, Muted, Title } from "@/components/ui";
import React, { useCallback, useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { spacing } from "@/theme/tokens";
import * as LocalAuthentication from "expo-local-authentication";

function AppGate() {
  return (
    <AppProvider>
      <LockGate>
        <ThemedStack />
      </LockGate>
    </AppProvider>
  );
}

/**
 * App lock gate: when enabled in Settings, the app content stays hidden
 * behind device authentication (biometrics or device passcode).
 * Re-locks whenever the app leaves the foreground. This gates access —
 * it is not database encryption (see PRIVACY.md).
 */
function LockGate({ children }: { children: React.ReactNode }) {
  const { ready, appLock } = useApp();
  const { theme } = useTheme();
  const [unlocked, setUnlocked] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Plouto",
        fallbackLabel: "Use passcode",
      });
      if (result.success) {
        setFailed(null);
        setUnlocked(true);
      } else {
        setFailed("Not unlocked. Try again.");
      }
    } catch {
      setFailed("Authentication is not available on this device.");
    }
  }, []);

  useEffect(() => {
    setUnlocked(false);
    setFailed(null);
  }, [appLock]);

  useEffect(() => {
    if (ready && appLock && !unlocked) authenticate();
  }, [ready, appLock, unlocked, authenticate]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  if (!ready) return null;
  if (appLock && !unlocked) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Title>Plouto is locked</Title>
        <Muted style={{ marginTop: 8, textAlign: "center" }}>
          Authenticate with Face ID, fingerprint, or your device passcode to continue.
        </Muted>
        {failed && <Muted style={{ marginTop: 8, color: theme.danger }}>{failed}</Muted>}
        <View style={{ width: "100%", marginTop: 20 }}>
          <Btn label="Unlock" onPress={authenticate} />
        </View>
      </View>
    );
  }
  return <>{children}</>;
}

function ThemedStack() {
  const { isDark } = useTheme();
  void useApp;
  void React;
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="snapshot/[id]" />
        <Stack.Screen name="snapshot/compare" />
        <Stack.Screen name="account/[id]" />
      </Stack>
      </NavThemeProvider>
    </>
  );
}
