import { Stack, ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";import { SafeAreaProvider } from "react-native-safe-area-context";
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
          <AppGate />
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
        <Stack.Screen
          name="snapshot/new"
          options={{
            presentation: "formSheet",
            contentStyle: { backgroundColor: isDark ? "#1C1C1E" : "#F7F8F6" },
            sheetAllowedDetents: [0.5, 1.0],
            sheetInitialDetentIndex: 1,
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            sheetExpandsWhenScrolledToEdge: true,
          }}
        />
        <Stack.Screen name="snapshot/[id]" />
        <Stack.Screen name="snapshot/compare" />
        <Stack.Screen name="account/[id]" />
        <Stack.Screen
          name="account/new"
          options={{
            presentation: "formSheet",
            contentStyle: { backgroundColor: isDark ? "#1C1C1E" : "#F7F8F6" },
            sheetAllowedDetents: [0.5, 1.0],
            sheetInitialDetentIndex: 1,
            sheetGrabberVisible: true,
            sheetCornerRadius: 20,
            sheetExpandsWhenScrolledToEdge: true,
          }}
        />
      </Stack>
      </NavThemeProvider>
    </>
  );
}
