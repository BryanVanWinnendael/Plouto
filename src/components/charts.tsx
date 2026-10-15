import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View, Text, useWindowDimensions } from "react-native";
import Svg, { Polyline, Circle, Line, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeContext";
import { toDecimal } from "@/finance/money";

export interface ChartPoint {
  label: string;
  value: string; // decimal
  key?: string;
}

/**
 * Interactive SVG line chart (recorded points only).
 * Pinch with two fingers to zoom into a window of points; tap a point for its readout.
 * `onSelect` / `selectedIndex` use GLOBAL point indexes so callers stay correct while zoomed.
 */
export function LineChart({
  points, height = 190, step = false, formatY, formatAxis, onZoomEdge, interactive = true, dots = true,
}: {
  points: ChartPoint[];
  height?: number;
  step?: boolean;
  /** Format raw decimal values for the selection readout (e.g. currency). */
  formatY?: (value: string) => string;
  /** Format raw decimal values for the short axis labels (defaults to formatY). */
  formatAxis?: (value: string) => string;
  /** Fired when pinching past the zoom limits (1 = zoom further in, -1 = zoom out). */
  onZoomEdge?: (dir: 1 | -1) => void;
  /** When false, points are not tappable (zoom still works). Defaults to true. */
  interactive?: boolean;
  /** Show data point dots. Defaults to true. */
  dots?: boolean;
}) {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const W = width - 32;
  const H = height;
  const PAD = 8;
  const GUTTER_R = 64;
  const DOT_MARGIN = 14;
  const plotX0 = 2;
  const plotX1 = W - GUTTER_R;
  const [hover, setHover] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [anchor, setAnchor] = useState<number | null>(null);

  // Touch state persists across moves within one gesture (plain refs, not hooks-in-callbacks).
  const pinchBase = useRef<{ d0: number; zoom0: number; lastFire: number } | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const indexFromLocalX = (lx: number) => {
    const m = visible.length;
    if (m <= 1) return 0;
    const seg = (plotX1 - DOT_MARGIN - plotX0) / (m - 1);
    return Math.min(m - 1, Math.max(0, Math.round((lx - plotX0) / seg)));
  };

  const n = points.length;
  const maxZoom = Math.max(1, n / 3);
  const z = Math.min(Math.max(zoom, 1), maxZoom);
  const count = Math.max(2, Math.round(n / z));
  const endA = anchor == null ? n - 1 : Math.min(Math.max(anchor, 0), n - 1);
  const start = n <= count ? 0 : Math.max(0, Math.min(endA - count + 1, n - count));
  const visible = points.slice(start, start + count);

  const { coords, min, mid, max } = useMemo(() => {
    const empty = { coords: [] as { x: number; y: number }[], min: "0", mid: "0", max: "1" };
    if (visible.length === 0) return empty;
    const vals = visible.map((p) => Number(toDecimal(p.value).toString()));
    let mn = Math.min(...vals);
    let mx = Math.max(...vals);
    if (mn === mx) { mn -= 1; mx += 1; }
    const m = visible.length;
    const coords = vals.map((v, i) => ({
      x: m === 1 ? (plotX0 + plotX1 - DOT_MARGIN) / 2 : plotX0 + (i * (plotX1 - DOT_MARGIN - plotX0)) / (m - 1),
      y: PAD + (1 - (v - mn) / (mx - mn)) * (H - PAD * 2),
    }));
    const minPt = visible.reduce((a, b) => (toDecimal(a.value).lt(toDecimal(b.value)) ? a : b)).value;
    const maxPt = visible.reduce((a, b) => (toDecimal(a.value).gt(toDecimal(b.value)) ? a : b)).value;
    const midPt = toDecimal(minPt).plus(toDecimal(maxPt)).div(2).toString();
    return { coords, min: minPt, mid: midPt, max: maxPt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, W, H]);

  if (n === 0) {
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

  const selLocal = hover != null && hover >= 0 && hover < visible.length ? hover : null;
  const fmt = (v: string) => (formatY ? formatY(v) : v);
  const fmtAxis = (v: string) => (formatAxis ? formatAxis(v) : fmt(v));

  // IBKR-style crosshair: vertical guide + value tag pinned to the selected point.
  let cross: { cx: number; tx: number; ty: number; tw: number; label: string; date: string } | null = null;
  if (selLocal != null && coords[selLocal]) {
    const cx = coords[selLocal].x;
    const cy = coords[selLocal].y;
    const label = fmt(visible[selLocal].value);
    const date = visible[selLocal].label;
    const tw = Math.max(label.length, date.length) * 6.5 + 20;
    const tx = Math.min(Math.max(cx, tw / 2 + 2), plotX1 - tw / 2 - 2);
    const ty = cy - 54 < 6 ? cy + 12 : cy - 54;
    cross = { cx, tx, tw, ty, label, date };
  }

  const handlePress = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    const g = start + i;
    setHover(i);
    setAnchor(g);
  };

  return (
    <View>
      <View
        onStartShouldSetResponder={() => interactive}
        onResponderTerminationRequest={() => true}
        onResponderGrant={(e) => {
          const t = e.nativeEvent.touches[0];
          if (t) {
            touchStart.current = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          }
          pinchBase.current = null;
        }}
        onResponderMove={(e) => {
          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            const d = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            const now = Date.now();
            if (!pinchBase.current) {
              pinchBase.current = { d0: d, zoom0: z, lastFire: 0 };
              return;
            }
            const b = pinchBase.current;
            const raw = b.zoom0 * (d / b.d0);
            const clamped = Math.min(Math.max(raw, 1), maxZoom);
            if (onZoomEdge && now - b.lastFire > 900) {
              if (d >= b.d0 && raw >= maxZoom) {
                b.lastFire = now;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onZoomEdge(1);
                return;
              }
              if (d < b.d0 * 0.7 && clamped <= 1) {
                b.lastFire = now;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                onZoomEdge(-1);
                return;
              }
            }
            setZoom(clamped);
            return;
          }
          if (!interactive) return;
          const i = indexFromLocalX(e.nativeEvent.locationX);
          setHover((prev) => (prev === i ? prev : i));
        }}
        onResponderRelease={(e) => {
          const s = touchStart.current;
          pinchBase.current = null;
          touchStart.current = null;
          if (!interactive || !s) return;
          const lx = e.nativeEvent.locationX;
          const ly = e.nativeEvent.locationY;
          // Tap (not a drag): crosshair here; reset zone clears zoom.
          if (Math.hypot(lx - s.x, ly - s.y) > 14) return;
          if (z > 1.01 && lx < 110 && ly < 52) {
            Haptics.selectionAsync().catch(() => {});
            setZoom(1);
            setAnchor(null);
            setHover(null);
            return;
          }
          handlePress(indexFromLocalX(lx));
        }}
        onResponderTerminate={() => {
          pinchBase.current = null;
          touchStart.current = null;
          setHover(null);
        }}
      >
        <Svg width={W} height={H} accessibilityLabel="Net worth history chart. Pinch to zoom.">
          {/* gridlines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={0} x2={plotX1} y1={H * f} y2={H * f} stroke={theme.border} strokeWidth={1} />
          ))}
          {/* X baseline + Y gutter separator: the line never enters the label zone */}
          <Line x1={0} x2={plotX1} y1={H - 1} y2={H - 1} stroke={theme.border} strokeWidth={1} />
          <Line x1={plotX1} x2={plotX1} y1={0} y2={H} stroke={theme.border} strokeWidth={1} />
          <Polyline points={path} fill="none" stroke={theme.primary} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {cross && (
            <G>
              <Line
                x1={cross.cx} x2={cross.cx} y1={0} y2={H}
                stroke={theme.primary} strokeWidth={1} strokeDasharray="4 3" opacity={0.55}
              />
              <Rect
                x={cross.tx - cross.tw / 2} y={cross.ty} width={cross.tw} height={42} rx={8}
                fill={theme.primary}
              />
              <SvgText
                x={cross.tx} y={cross.ty + 16} textAnchor="middle"
                fontSize={11} fontWeight="700" fill={isDark ? "#000000" : "#FFFFFF"}
              >
                {cross.label}
              </SvgText>
              <SvgText
                x={cross.tx} y={cross.ty + 30} textAnchor="middle"
                fontSize={9} fill={isDark ? "#000000" : "#FFFFFF"} opacity={0.75}
              >
                {cross.date}
              </SvgText>
            </G>
          )}
          <G>
            {dots && coords.map((c, i) => (
              <Circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={selLocal === i ? 6 : 3.5}
                fill={selLocal === i ? theme.primary : theme.surface}
                stroke={theme.primary}
                strokeWidth={2}
              />
            ))}
          </G>
          {/* Y axis labels: max / mid / min, floating over the plot */}
          <SvgText x={W - 4} y={12} textAnchor="end" fontSize={10} fill={theme.muted}>
            {fmtAxis(max)}
          </SvgText>
          <SvgText x={W - 4} y={H / 2 + 3} textAnchor="end" fontSize={10} fill={theme.muted}>
            {fmtAxis(mid)}
          </SvgText>
          <SvgText x={W - 4} y={H - 4} textAnchor="end" fontSize={10} fill={theme.muted}>
            {fmtAxis(min)}
          </SvgText>
        </Svg>
        {z > 1.01 && (
          <View
            accessibilityLabel="Reset chart zoom. Double tap the top left of the chart to reset."
            style={{ position: "absolute", top: 6, left: 6, borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: theme.border }}
          >
            <BlurView
              intensity={60}
              tint={isDark ? "systemThinMaterialDark" : "systemThinMaterialLight"}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ paddingVertical: 7, paddingHorizontal: 12 }}>
              <Text style={{ color: theme.primary, fontSize: 12, fontWeight: "700" }}>Reset zoom</Text>
            </View>
          </View>
        )}
      </View>
      {/* X axis: first / last visible observation dates */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ color: theme.muted, fontSize: 10 }}>{visible[0].label}</Text>
        {visible.length > 1 && (
          <Text style={{ color: theme.muted, fontSize: 10 }}>{visible[visible.length - 1].label}</Text>
        )}
      </View>
    </View>
  );
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

/** Allocation donut with tappable wedges: tap a section to spotlight it in the center. */
export function DonutChart({
  slices, size = 190, centerValue, centerLabel,
}: {
  slices: { label: string; pct: string; color: string; value: string }[];
  size?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const { theme } = useTheme();
  const [sel, setSel] = useState<number | null>(null);
  const R = size / 2 - 14;
  const half = 13; // half of ring thickness
  const cx = size / 2;
  const cy = size / 2;
  const selected = sel != null && sel < slices.length ? slices[sel] : null;

  let acc = -Math.PI / 2;
  const wedges = slices.map((s) => {
    const frac = Math.max(0, Math.min(100, Number(s.pct))) / 100;
    const a0 = acc;
    const a1 = acc + frac * 2 * Math.PI;
    acc = a1;
    if (frac <= 0) return null;
    const o0 = polar(cx, cy, R + half, a0);
    const o1 = polar(cx, cy, R + half, a1);
    const i1 = polar(cx, cy, R - half, a1);
    const i0 = polar(cx, cy, R - half, a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return {
      d: `M ${o0.x} ${o0.y} A ${R + half} ${R + half} 0 ${large} 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${R - half} ${R - half} 0 ${large} 0 ${i0.x} ${i0.y} Z`,
    };
  });

  const toggle = (i: number) => {
    Haptics.selectionAsync().catch(() => {});
    setSel((prev) => (prev === i ? null : i));
  };

  return (
    <View style={{ alignItems: "center" }}>
      <View>
        <Svg width={size} height={size} accessibilityLabel="Allocation chart. Tap a section for details.">
          {slices.map((s, i) => {
            const w = wedges[i];
            if (!w) return null;
            const dimmed = selected != null && sel !== i;
            return (
              <Path
                key={s.label}
                d={w.d}
                fill={s.color}
                opacity={dimmed ? 0.3 : 1}
                onPress={() => toggle(i)}
                accessibilityLabel={`${s.label}: ${s.pct} percent, ${s.value}. ${sel === i ? "Selected." : "Tap to spotlight."}`}
              />
            );
          })}
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            alignItems: "center", justifyContent: "center", paddingHorizontal: 40,
          }}
        >
          {selected ? (
            <>
              <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
                {selected.value}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                {selected.label}
              </Text>
              <Text style={{ color: theme.primary, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
                {selected.pct}%
              </Text>
            </>
          ) : (
            <>
              {!!centerValue && (
                <Text style={{ color: theme.text, fontWeight: "800", fontSize: 17, fontVariant: ["tabular-nums"] }} numberOfLines={1}>
                  {centerValue}
                </Text>
              )}
              {!!centerLabel && (
                <Text style={{ color: theme.muted, fontSize: 11 }}>{centerLabel}</Text>
              )}
            </>
          )}
        </View>
      </View>
      <View style={{ marginTop: 8, width: "100%" }}>
        {slices.map((s, i) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            accessibilityLabel={`Spotlight ${s.label}`}
            onPress={() => toggle(i)}
            style={{
              flexDirection: "row", alignItems: "center", paddingVertical: 6,
              paddingHorizontal: 8, borderRadius: 8,
              backgroundColor: sel === i ? theme.primarySoft : "transparent",
            }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.color, marginRight: 8 }} />
            <Text style={{ flex: 1, color: theme.text, fontSize: 13 }}>{s.label}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, fontVariant: ["tabular-nums"] }}>{s.pct}% · {s.value}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
