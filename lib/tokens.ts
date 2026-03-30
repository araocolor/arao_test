/**
 * 디자인 토큰 — CSS 변수와 동일한 값을 JS 상수로 관리
 * React Native 전환 시 이 파일을 그대로 재사용 (CSS 변수는 RN 미지원)
 */

export const colors = {
  brand:       "#FF2D2D",
  text:        "#111111",
  muted:       "#6e6e73",
  surface:     "#ffffff",
  surfaceSoft: "rgba(255, 255, 255, 0.9)",
  bg:          "#f5f5f7",
  line:        "rgba(17, 17, 17, 0.08)",
  footerBg:    "#111111",
  footerText:  "#cccccc",
  yellow:      "#FCD34D",
  yellowBg:    "rgba(252, 211, 77, 0.18)",
} as const;

export const shadows = {
  soft: "0 4px 12px rgba(17, 17, 17, 0.1)",
  card: "0 10px 30px rgba(15, 23, 42, 0.06)",
} as const;

export const radius = {
  card:   20,
  button: 999,
  sheet:  20,
} as const;

export const spacing = {
  page:    16,
  section: 24,
  gap:     16,
} as const;

export const widths = {
  mobile:  480,
  tablet:  820,
  desktop: 1200,
} as const;
