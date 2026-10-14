import React, { useMemo, useState } from "react";
import { Pressable, View, Text, useWindowDimensions } from "react-native";
import Svg, { Polyline, Circle, Line, G } from "react-native-svg";
import { useTheme } from "@/theme/ThemeContext";
import { toDecimal } from "@/finance/money";

export interface ChartPoint {
  label: string;
  value: string; // decimal
  key?: string;
}

/** Interactive SVG line chart (recorded points only — no interpolation fabrication beyond straight segments). */
export function LineChart({
  points, height = 190, onSelect, selectedIndex, step = false,
}: {
  points: ChartPoint[];
  height?: number;
  onSelect?: (i: number) => void;
  selectedIndex?: number | null;
  step?: boolean;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const W = width - 64;
  const H = height;
  const PAD = 8;
  const [hover, setHover] = useState<number | null>(null);

  const { coords, min, max } = useMemo(() => {
    if (points.length === 0) return { coords: [] as { x: number; y: number }[], min: 0, max: 1 };
    const vals = points.map((p) => Number(toDecimal(p.value).toString()));
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const n = points.length;
    const coords = vals.map((v, i) => ({
      x: n === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (n - 1),
      y: PAD + (1 - (v - mn) / (mx - mn)) * (H - PAD * 2),
    }));
    return { coords, min: mn, max: mx };
  }, [points, W, H]);

  if (points.length === 0) {
    return (
      <View style={{ height: H, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: theme.muted }}>No data yet</Text>
      </View>
    );
  }

  let path = "";
  if (step) {
    coords.forEach((c, i) => {
      if (i === 0) path += `${c.x},${c.y} `;
      else path += `${coords[i - 1].x},${c.y} ${c.x},${c.y} `;
    });
  } else {
    path = coords.map((c) => `${c.x},${c.y}`).join(" ");
  }
  void min; void max;

  const sel = selectedIndex ?? hover;

  return (
    <View>
      <Svg width={W} height={H} accessibilityLabel="Net worth history chart">
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <Line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke={theme.border} strokeWidth={1} />
        ))}
        <Polyline points={path} fill="none" stroke={theme.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <G>
          {coords.map((c, i) => (
            <Circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={sel === i ? 6 : 3.5}
              fill={sel === i ? theme.primary : theme.surface}
              stroke={theme.primary}
              strokeWidth={2}
            />
          ))}
        </G>
      </Svg>
      {/* touch targets */}
      <View style={{ flexDirection: "row", marginTop: -H, height: H }}>
        {coords.map((_, i) => (
          <Pressable
            key={i}
            accessibilityLabel={`Point ${points[i].label}`}
            style={{ flex: 1 }}
            onPress={() => {
              setHover(i);
              onSelect?.(i);
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function DonutChart({ slices, size = 190 }: { slices: { label: string; pct: string; color: string; value: string }[]; size?: number }) {
  const { theme } = useTheme();
  const R = size / 2 - 14;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} accessibilityLabel="Allocation chart">
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {slices.map((s, i) => {
            const frac = Math.max(0, Math.min(100, Number(s.pct))) / 100;
            const el = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={R}
                stroke={s.color}
                strokeWidth={26}
                fill="transparent"
                strokeDasharray={`${frac * C} ${C}`}
                strokeDashoffset={-acc * C}
                strokeLinecap="butt"
              />
            );
            acc += frac;
            return el;
          })}
        </G>
      </Svg>
      <View style={{ marginTop: 8, width: "100%" }}>
        {slices.map((s) => (
          <View key={s.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.color, marginRight: 8 }} />
            <Text style={{ flex: 1, color: theme.text, fontSize: 13 }}>{s.label}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>{s.pct}% · {s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
