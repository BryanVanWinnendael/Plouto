import React from "react";
import { View } from "react-native";
import { Host, Menu, Toggle, HStack, Spacer, Text as UIText, Image } from "@expo/ui/swift-ui";
import { foregroundStyle } from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "@/theme/ThemeContext";

const LABELS = { light: "Light", dark: "Dark", system: "System" } as const;
type ModeKey = keyof typeof LABELS;

/** Native iOS dropdown for theme selection. Every color is explicit — no system blue anywhere. */
export function ThemeMenu() {
  const { theme, mode, setMode } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface2,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 12,
      }}
    >
      <Host style={{ width: "100%", height: 48 }}>
        <Menu
          label={
            <HStack>
              <UIText modifiers={[foregroundStyle(theme.text)]}>Appearance</UIText>
              <Spacer />
              <UIText modifiers={[foregroundStyle(theme.muted)]}>{LABELS[mode as ModeKey]}</UIText>
              <Image systemName="chevron.up.chevron.down" modifiers={[foregroundStyle(theme.muted)]} />
            </HStack>
          }
        >
          {(Object.keys(LABELS) as ModeKey[]).map((m) => (
            <Toggle key={m} isOn={mode === m} label={LABELS[m]} onIsOnChange={() => setMode(m)} />
          ))}
        </Menu>
      </Host>
    </View>
  );
}
