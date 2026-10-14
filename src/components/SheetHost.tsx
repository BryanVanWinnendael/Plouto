import React from "react";
import { View } from "react-native";
import { Host, BottomSheet, Group, RNHostView } from "@expo/ui/swift-ui";
import {
  presentationDetents,
  presentationDragIndicator,
  preferredColorScheme,
} from "@expo/ui/swift-ui/modifiers";
import { useTheme } from "@/theme/ThemeContext";

/**
 * Native SwiftUI bottom sheet: system glass background, medium/large
 * snap points, drag indicator. Content unmounts on dismiss, so forms
 * always open fresh. The 1px anchor keeps layout unaffected.
 */
export function SheetHost({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  return (
    <Host style={{ width: 1, height: 1, opacity: 0 }}>
      <BottomSheet
        isPresented={open}
        onIsPresentedChange={onOpenChange}
        anchor={
          <RNHostView matchContents>
            <View />
          </RNHostView>
        }
      >
        <Group
          modifiers={[
            presentationDetents(["medium", "large"]),
            presentationDragIndicator("visible"),
            preferredColorScheme(isDark ? "dark" : "light"),
          ]}
        >
          <RNHostView>
            <View style={{ flex: 1 }}>{children}</View>
          </RNHostView>
        </Group>
      </BottomSheet>
    </Host>
  );
}
