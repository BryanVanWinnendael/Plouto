import { router } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTheme } from "@/theme/ThemeContext";
import { useApp } from "@/store/AppContext";
import { useEffect } from "react";

export default function TabsLayout() {
  const { theme, isDark } = useTheme();
  const { ready, onboarded } = useApp();

  useEffect(() => {
    if (ready && !onboarded) router.replace("/onboarding");
  }, [ready, onboarded]);

  return (
    <NativeTabs
      tintColor={theme.primary}
      blurEffect={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="chart.pie" />
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf="clock" />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts">
        <NativeTabs.Trigger.Icon sf="banknote" />
        <NativeTabs.Trigger.Label>Accounts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gear" />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
