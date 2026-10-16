import React, { useState } from "react";
import { Alert, ScrollView, Share, Text, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { Host, Toggle, Picker, Text as UIText } from "@expo/ui/swift-ui";
import { environment, tint, pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { useApp } from "@/store/AppContext";
import { useTheme } from "@/theme/ThemeContext";
import { spacing } from "@/theme/tokens";
import { Btn, Card, Muted, Title } from "@/components/ui";
import { exportBackup, importBackup, validateBackup } from "@/db/backup";
import { getSetting, setSetting, wipeAll } from "@/db/repo";

export default function Settings() {
  const { theme, mode, setMode, isDark } = useTheme();
  const db = useSQLiteContext();
  const app = useApp();
  const [lock, setLock] = useState(false);

  React.useEffect(() => {
    getSetting(db, "appLock").then((v) => setLock(v === "1")).catch(() => {});
  }, [db]);

  const doExport = async () => {
    try {
      const backup = await exportBackup(db);
      const json = JSON.stringify(backup, null, 2);
      const name = `plouto-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File(Paths.document, name);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      // iOS share sheet so you can Save to Files, AirDrop, etc.
      await Share.share({ url: file.uri, title: "Plouto backup" });
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Unknown error");
    }
  };

  const doImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (res.canceled) return;
      const text = await new File(res.assets[0].uri).text();
      const data = JSON.parse(text);
      validateBackup(data);
      Alert.alert("Restore backup?", `Version ${data.version}, exported ${data.exportedAt}. This replaces all current data.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore", style: "destructive",
          onPress: async () => {
            await importBackup(db, data);
            await app.refresh();
            Alert.alert("Restored", "Backup imported successfully.");
          },
        },
      ]);
    } catch (e) {
      Alert.alert("Import failed", e instanceof Error ? e.message : "Invalid file.");
    }
  };

  return (
    <View collapsable={false} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.l, paddingBottom: 16 }}
      >
        <Title>Settings</Title>
        <Muted>Private by design — everything stays on this device.</Muted>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Theme</Text>
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
              <Picker
                label="Appearance"
                selection={mode}
                onSelectionChange={(v) => setMode(v as "light" | "dark" | "system")}
                modifiers={[
                  pickerStyle("menu"),
                  environment("colorScheme", isDark ? "dark" : "light"),
                  tint(theme.primary),
                ]}
              >
                <UIText modifiers={[tag("light")]}>Light</UIText>
                <UIText modifiers={[tag("dark")]}>Dark</UIText>
                <UIText modifiers={[tag("system")]}>System</UIText>
              </Picker>
            </Host>
          </View>
        </Card>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700" }}>App lock</Text>
          <Muted>Device biometrics/PIN. An app lock is not database encryption.</Muted>
          <Host style={{ width: "100%", height: 48 }}>
            <Toggle
              label="Require authentication"
              isOn={lock}
              onIsOnChange={async (v) => {
                setLock(v);
                await setSetting(db, "appLock", v ? "1" : "0");
              }}
              modifiers={[environment("colorScheme", isDark ? "dark" : "light"), tint(theme.primary)]}
            />
          </Host>
        </Card>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>Backup (local JSON)</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Btn label="Export" onPress={doExport} /></View>
            <View style={{ flex: 1 }}><Btn label="Import" variant="ghost" onPress={doImport} /></View>
          </View>
          <Muted style={{ marginTop: 8 }}>Backups are never uploaded automatically. Exported files contain sensitive data.</Muted>
        </Card>

        <Card>
          <Text style={{ color: theme.text, fontWeight: "700" }}>Privacy</Text>
          <Muted>
            • No backend, no accounts, no sync, no bank connections, no analytics, no ads, no AI calls.{"\n"}
            • Data lives in this app's private SQLite database and works fully offline.{"\n"}
            • Local storage ≠ encryption. Device security (passcode, OS sandbox) protects data at rest; the database file itself is not encrypted unless SQLCipher is enabled in a custom build.{"\n"}
            • No balances or notes are logged.
          </Muted>
        </Card>

        <Card>
          <Text style={{ color: theme.danger, fontWeight: "700", marginBottom: 8 }}>Danger zone</Text>
          <Btn
            label="Delete all local data"
            variant="danger"
            onPress={() => Alert.alert("Delete everything?", "All accounts, snapshots and settings on this device will be removed.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => { await wipeAll(db); await app.refresh(); } },
            ])}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

