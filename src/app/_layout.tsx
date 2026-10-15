import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";import { SafeAreaProvider } from "react-native-safe-area-context";
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
import React from "react";

function AppGate() {
  return (
    <AppProvider>
      <ThemedStack />
    </AppProvider>
  );
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
