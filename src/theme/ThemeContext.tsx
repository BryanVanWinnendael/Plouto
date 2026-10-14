import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { dark, light, type Theme } from "./tokens";

type Mode = "light" | "dark" | "system";

const Ctx = createContext<{ theme: Theme; mode: Mode; setMode: (m: Mode) => void; isDark: boolean }>({
  theme: light, mode: "system", setMode: () => {}, isDark: false,
});

export function ThemeProvider({ initial, children }: { initial?: Mode; children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(initial ?? "system");
  const [sys, setSys] = useState<ColorSchemeName | null>(Appearance.getColorScheme() ?? null);
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSys(colorScheme));
    return () => sub.remove();
  }, []);
  const isDark = mode === "dark" || (mode === "system" && sys === "dark");
  const theme = useMemo(() => (isDark ? dark : light), [isDark]);
  return <Ctx.Provider value={{ theme, mode, setMode, isDark }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
