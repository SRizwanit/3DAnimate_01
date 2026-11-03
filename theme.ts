// theme.ts — ধাপ ৩: থিম ও ডিজাইন সিস্টেম
// থিম: "নিঝুম গ্রামবাংলার গোধূলি-রাত" — গোধূলির সোনালি থেকে ধীরে ঘন নীল রাত, হারিকেনের কমলা আভা,
// চাঁদের রুপালি আলো, কুয়াশার ধূসর। সব মাপ 1080×1920 ভিত্তিক; 4K-তে স্কেল ×২।

import { loadFont as loadHindSiliguri } from "@remotion/google-fonts/HindSiliguri";
import { loadFont as loadTiroBangla } from "@remotion/google-fonts/TiroBangla";
import type { Mood } from "./scenes";

// ---------------------------------------------------------------------------
// ফরম্যাট ও স্কেল (9:16)
// ---------------------------------------------------------------------------
export const BASE_WIDTH = 1080;
export const BASE_HEIGHT = 1920;

export const FORMATS = {
  HD: { id: "Story-HD", width: 1080, height: 1920, scale: 1 },
  "4K": { id: "Story-4K", width: 2160, height: 3840, scale: 2 },
} as const;
export type FormatKey = keyof typeof FORMATS;

/** ১০৮০-ভিত্তিক মাপকে বর্তমান ফরম্যাটের পিক্সেলে রূপান্তর */
export const px = (n: number, scale: number) => Math.round(n * scale);

// ---------------------------------------------------------------------------
// নিরাপদ অঞ্চল — ক্যাপশন যেন কনটেন্ট না ঢাকে
// ---------------------------------------------------------------------------
export const SAFE = {
  top: 0.08,               // ওপরে ৮% খালি (প্ল্যাটফর্ম UI)
  subjectBottom: 0.72,     // 3D বিষয় (চরিত্র/ঘর) থাকবে ০.০৮–০.৭২ উচ্চতায়
  captionTop: 0.74,        // ক্যাপশন শুরু
  captionBottom: 0.92,     // ক্যাপশন শেষ (নিচের ৮% প্ল্যাটফর্ম UI-র জন্য খালি)
  sideMargin: 80,          // দুই পাশে (১০৮০ ভিত্তিক px)
} as const;

export const layout = (width: number, height: number) => ({
  subject: { top: height * SAFE.top, bottom: height * SAFE.subjectBottom },
  caption: {
    top: height * SAFE.captionTop,
    bottom: height * SAFE.captionBottom,
    height: height * (SAFE.captionBottom - SAFE.captionTop),
    left: (SAFE.sideMargin / BASE_WIDTH) * width,
    width: width - 2 * (SAFE.sideMargin / BASE_WIDTH) * width,
  },
  card: { top: height * 0.1 }, // স্থান/সাল কার্ড ওপরের দিকে
});

// ---------------------------------------------------------------------------
// ফন্ট (বাংলা)
// ---------------------------------------------------------------------------
const hind = loadHindSiliguri("normal", { weights: ["500", "600", "700"], subsets: ["bengali", "latin"] });
const tiro = loadTiroBangla("normal", { weights: ["400"], subsets: ["bengali", "latin"] });

export const FONTS = {
  caption: hind.fontFamily,   // ক্যাপশন: পরিষ্কার, মোটা
  card: tiro.fontFamily,      // স্থান/সাল কার্ড: গল্পের আমেজের সেরিফ
} as const;

export const TYPE = {
  captionSize: 78,       // ১০৮০ ভিত্তিক px
  captionWeight: 700,
  captionLineHeight: 1.28,
  captionMaxLines: 2,
  captionStroke: 10,
  cardSize: 92,
  cardSizeSmall: 60,
} as const;

// ---------------------------------------------------------------------------
// মূল রঙ
// ---------------------------------------------------------------------------
export const COLORS = {
  ink: "#070b1f",          // গভীর রাত (সবচেয়ে গাঢ়)
  night: "#0d1a45",
  indigo: "#1d2f75",
  moon: "#e9f0ff",         // চাঁদের রুপালি-সাদা
  moonGlow: "#9ec1ff",
  lantern: "#ffb347",      // হারিকেনের আভা
  lanternDeep: "#e8741f",
  paddy: "#c9b34a",        // পাকা ধান
  paddyGreen: "#5f8f3a",   // কাঁচা ধান
  soil: "#6b4a32",         // মাটি
  thatch: "#b8893c",       // খড়ের চাল
  bamboo: "#8a9a4a",
  fog: "#9aa7c7",
  skin: ["#e0a878", "#c98b5b", "#a8693f"],   // চরিত্রের ত্বকের রঙ
  cloth: ["#b23a3a", "#2f6f8f", "#d0a23a", "#6b3f8f", "#3f8f5f", "#e07a3a"], // শাড়ি/লুঙ্গি/জামা
  white: "#ffffff",
} as const;

// ---------------------------------------------------------------------------
// আবহ (mood) অনুযায়ী আলো — scenes.ts-এর Mood-এর সাথে মেলানো
// ---------------------------------------------------------------------------
export type MoodTheme = {
  skyTop: string;
  skyBottom: string;
  fog: string;
  fogNear: number;        // কুয়াশা শুরু (3D একক)
  fogFar: number;         // কুয়াশা শেষ
  ambient: string;
  ambientIntensity: number;
  keyColor: string;       // চাঁদ/সূর্যের মূল আলো
  keyIntensity: number;
  lanternIntensity: number;
  moonVisible: number;    // 0–1 (চাঁদ কতটা স্পষ্ট)
  starsVisible: number;   // 0–1
  grain: number;          // ফিল্ম-গ্রেইন (0–1)
  vignette: number;       // কোণা কালচে (0–1)
  grade: { saturation: number; contrast: number }; // কালার গ্রেড
};

export const MOODS: Record<Mood, MoodTheme> = {
  dusk: {
    skyTop: "#27387a", skyBottom: "#f0a45e", fog: "#c98d6e", fogNear: 30, fogFar: 120,
    ambient: "#ffd2a0", ambientIntensity: 0.7, keyColor: "#ffc78a", keyIntensity: 1.2,
    lanternIntensity: 0.2, moonVisible: 0.55, starsVisible: 0.25, grain: 0.05, vignette: 0.3,
    grade: { saturation: 1.1, contrast: 1.05 },
  },
  evening: {
    skyTop: "#1a2a62", skyBottom: "#d4704a", fog: "#a8627a", fogNear: 24, fogFar: 100,
    ambient: "#c8a0b8", ambientIntensity: 0.55, keyColor: "#ffb97a", keyIntensity: 0.95,
    lanternIntensity: 0.9, moonVisible: 0.75, starsVisible: 0.5, grain: 0.06, vignette: 0.35,
    grade: { saturation: 1.05, contrast: 1.08 },
  },
  tense: {
    skyTop: "#12163a", skyBottom: "#6e2f45", fog: "#4d2c40", fogNear: 14, fogFar: 70,
    ambient: "#8a6a92", ambientIntensity: 0.4, keyColor: "#c0a0d8", keyIntensity: 0.7,
    lanternIntensity: 1.1, moonVisible: 0.85, starsVisible: 0.7, grain: 0.09, vignette: 0.5,
    grade: { saturation: 0.92, contrast: 1.15 },
  },
  night: {
    skyTop: "#060c2a", skyBottom: "#1b3170", fog: "#2a3c78", fogNear: 12, fogFar: 85,
    ambient: "#5870b8", ambientIntensity: 0.38, keyColor: "#cfe0ff", keyIntensity: 1.0,
    lanternIntensity: 0.9, moonVisible: 1, starsVisible: 1, grain: 0.08, vignette: 0.5,
    grade: { saturation: 0.95, contrast: 1.12 },
  },
  lonely: {
    skyTop: "#03061a", skyBottom: "#0f1f52", fog: "#1a2a5a", fogNear: 8, fogFar: 60,
    ambient: "#3c4f90", ambientIntensity: 0.3, keyColor: "#bcd2ff", keyIntensity: 0.9,
    lanternIntensity: 1.4, moonVisible: 1, starsVisible: 1, grain: 0.1, vignette: 0.6,
    grade: { saturation: 0.9, contrast: 1.18 },
  },
};

// ---------------------------------------------------------------------------
// ক্যাপশন রঙের সেট — scenes.ts-এর captionPalette (০–৭) এর সাথে মেলে
// text: সাধারণ শব্দ · active: এখন বলা শব্দ · accent: পপ/আন্ডারলাইন · stroke: বাইরের রেখা
// glow: হালকা দ্যুতি · pill: ব্যাকগ্রাউন্ড পটি (ঝাপসা, কম স্বচ্ছ — কনটেন্ট ঢাকে না)
// ---------------------------------------------------------------------------
export type CaptionPalette = {
  text: string; active: string; accent: string; stroke: string; glow: string; pill: string;
};

export const CAPTION_PALETTES: CaptionPalette[] = [
  /* ০ */ { text: "#ffffff", active: "#ffd23f", accent: "#ff7a1a", stroke: "#1a1030", glow: "#ffb347", pill: "rgba(10,12,40,0.45)" },
  /* ১ */ { text: "#fff7e6", active: "#7ef0c8", accent: "#2fd1a0", stroke: "#0a2a2a", glow: "#5ee6c0", pill: "rgba(8,30,34,0.45)" },
  /* ২ */ { text: "#ffffff", active: "#ff8fb8", accent: "#ff4f94", stroke: "#2a0f26", glow: "#ff7aa8", pill: "rgba(36,10,34,0.45)" },
  /* ৩ */ { text: "#f2f7ff", active: "#7cc6ff", accent: "#2f9bff", stroke: "#0a1a3a", glow: "#6bb8ff", pill: "rgba(8,16,48,0.45)" },
  /* ৪ */ { text: "#fffbe8", active: "#ffe14d", accent: "#ff5a3c", stroke: "#3a1408", glow: "#ffcb3d", pill: "rgba(40,16,8,0.45)" },
  /* ৫ */ { text: "#ffffff", active: "#ff6b6b", accent: "#ffb347", stroke: "#240808", glow: "#ff5252", pill: "rgba(34,8,14,0.5)" },
  /* ৬ */ { text: "#f4f0ff", active: "#c9a2ff", accent: "#8f5bff", stroke: "#150c33", glow: "#b386ff", pill: "rgba(16,10,44,0.45)" },
  /* ৭ */ { text: "#eefcff", active: "#9dfcff", accent: "#35e0f0", stroke: "#06242e", glow: "#6df0ff", pill: "rgba(6,24,38,0.45)" },
];

// ---------------------------------------------------------------------------
// অ্যানিমেশন নিয়ম (ধাপ ৪–৬ এই মানগুলো ব্যবহার করবে)
// ---------------------------------------------------------------------------
export const MOTION = {
  sceneFadeFrames: 12,                      // সিনের মাঝে ক্রসফেড
  captionPopFrames: 6,                      // সক্রিয় শব্দের পপ
  captionSpring: { damping: 12, stiffness: 170, mass: 0.6 },
  captionActiveScale: 1.14,
  captionWordsPerGroup: { min: 2, max: 5 }, // এক গ্রুপে শব্দ সংখ্যা
  captionLeadMs: 40,                        // শব্দ বলার একটু আগে হাইলাইট
  cardInFrames: 14,
  cardHoldMs: 2200,
  cameraEase: "easeInOutCubic",
} as const;

// ---------------------------------------------------------------------------
// ছোট হেল্পার
// ---------------------------------------------------------------------------
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

export const lerpColor = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const k = Math.min(1, Math.max(0, t));
  const m = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, "0");
  return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
};

/** দুই আবহের মাঝামাঝি (সিন বদলের সময় নরম পরিবর্তন) */
export const blendMood = (from: Mood, to: Mood, t: number): MoodTheme => {
  const a = MOODS[from];
  const b = MOODS[to];
  const n = (x: number, y: number) => x + (y - x) * t;
  return {
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    fog: lerpColor(a.fog, b.fog, t),
    fogNear: n(a.fogNear, b.fogNear),
    fogFar: n(a.fogFar, b.fogFar),
    ambient: lerpColor(a.ambient, b.ambient, t),
    ambientIntensity: n(a.ambientIntensity, b.ambientIntensity),
    keyColor: lerpColor(a.keyColor, b.keyColor, t),
    keyIntensity: n(a.keyIntensity, b.keyIntensity),
    lanternIntensity: n(a.lanternIntensity, b.lanternIntensity),
    moonVisible: n(a.moonVisible, b.moonVisible),
    starsVisible: n(a.starsVisible, b.starsVisible),
    grain: n(a.grain, b.grain),
    vignette: n(a.vignette, b.vignette),
    grade: {
      saturation: n(a.grade.saturation, b.grade.saturation),
      contrast: n(a.grade.contrast, b.grade.contrast),
    },
  };
};
