import React from "react";
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/theme/ThemeContext";
import { BUTTON_MIN_HEIGHT, radius, spacing } from "@/theme/tokens";
import * as Haptics from "expo-haptics";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {children}
    </View>
  );
}

/** Frosted liquid-glass card (system material blur). Use sparingly for hero surfaces. */
export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme, isDark } = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: theme.border,
          marginTop: spacing.s,
          marginBottom: spacing.m,
        },
        style,
      ]}
    >
      <BlurView
        intensity={70}
        tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ padding: spacing.l }}>{children}</View>
    </View>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { theme } = useTheme();
  return <Text style={[{ fontSize: 22, fontWeight: "700", color: theme.text }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { theme } = useTheme();
  return <Text style={[{ fontSize: 13, color: theme.muted }, style]}>{children}</Text>;
}

export function Money({ value, style, small }: { value: string; style?: TextStyle; small?: boolean }) {
  const { theme } = useTheme();
  return (
    <Text
      accessibilityRole="text"
      style={[{ fontSize: small ? 17 : 26, fontWeight: "700", color: theme.text, fontVariant: ["tabular-nums"] }, style]}
    >
      {value}
    </Text>
  );
}

/**
 * Single shared button. Always full-width with the same minimum height,
 * so every button in the app renders at a consistent size.
 * Primary actions float over a liquid-glass blur; in dark mode the
 * prominent fill is near-white with black text (iOS style).
 */
export function Btn({
  label, onPress, variant = "primary", disabled,
}: { label: string; onPress: () => void; variant?: "primary" | "ghost" | "danger"; disabled?: boolean }) {
  const { theme, isDark } = useTheme();
  const overlay =
    variant === "primary" ? theme.primary : variant === "danger" ? theme.danger : "transparent";
  const fg = variant === "ghost" ? theme.text : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: BUTTON_MIN_HEIGHT,
          borderRadius: radius.l,
          overflow: "hidden",
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: theme.border,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
          alignSelf: "stretch",
        },
      ]}
    >
      <BlurView
        intensity={50}
        tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={{
          backgroundColor: overlay,
          minHeight: BUTTON_MIN_HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.l,
          paddingVertical: spacing.s,
        }}
      >
        <Text numberOfLines={1} style={{ color: fg, fontWeight: "700", fontSize: 16 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
        backgroundColor: active ? theme.primarySoft : theme.surface2,
        borderWidth: 1, borderColor: active ? theme.primary : theme.border,
        marginRight: 8,
      }}
    >
      <Text style={{ color: active ? theme.text : theme.muted, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.l,
    borderWidth: 1,
    padding: spacing.l,
    marginTop: spacing.s,
    marginBottom: spacing.m,
  },
});

/**
 * Surface ramp for native sheet screens. In dark mode the sheet sits on a
 * lifted background so it reads as a surface above the dimmed content
 * behind it (pure black-on-black is invisible). Cards and inputs inside a
 * sheet shift one level up the ramp to keep their contrast.
 */
export function useSheet() {
  const { theme, isDark } = useTheme();
  if (!isDark) return { bg: theme.bg, surface: theme.surface, surface2: theme.surface2 };
  return { bg: "#1C1C1E", surface: "#2C2C2E", surface2: "#3A3A3E" };
}
