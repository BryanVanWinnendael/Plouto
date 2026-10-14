export const light = {
  bg: "#F7F8F6",
  surface: "#FFFFFF",
  surface2: "#EFF2EE",
  text: "#14201A",
  muted: "#5E6E63",
  border: "#E2E8E2",
  primary: "#1E6B45",
  primarySoft: "#E4F1E8",
  danger: "#B3402E",
  dangerSoft: "#F9E7E3",
  warn: "#9A6B1E",
  gain: "#1E6B45",
  loss: "#B3402E",
  card: "#FFFFFF",
  tabBar: "#FFFFFF",
};

export const dark = {
  bg: "#000000",
  surface: "#1C1C1E",
  surface2: "#2C2C2E",
  text: "#F5F5F7",
  muted: "#9E9EA8",
  border: "rgba(255,255,255,0.14)",
  primary: "#4CB782",
  primarySoft: "rgba(76,183,130,0.18)",
  danger: "#FF453A",
  dangerSoft: "rgba(255,69,58,0.16)",
  warn: "#FFD60A",
  gain: "#30D158",
  loss: "#FF453A",
  card: "#1C1C1E",
  tabBar: "#000000",
};

export type Theme = typeof light;
export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 8, m: 12, l: 16, xl: 22 };
export const type = {
  hero: 34,
  title: 22,
  subtitle: 16,
  body: 15,
  small: 13,
  tiny: 11,
  money: 28,
};

/** Minimum touch-target height shared by every button, so all buttons render the same size. */
export const BUTTON_MIN_HEIGHT = 52;
