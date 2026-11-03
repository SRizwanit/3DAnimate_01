// Captions.tsx — ধাপ ৬: অ্যানিমেটেড রঙিন ক্যাপশন (শব্দ ধরে ধরে সিঙ্ক)
// ব্যবহার (ধাপ ৭-এ): <Captions /> — সবার ওপরের লেয়ারে, পুরো ভিডিও জুড়ে একটাই বসবে।
//
// যা করে:
//  • scenes.ts-এর অডিও-সিঙ্ক করা শব্দ-টাইমিং থেকে ২–৫ শব্দের গ্রুপ বানায় (বাক্যের শেষ ও সিনের সীমা কখনো পার হয় না)
//  • এখন বলা শব্দটি রঙ বদলে, স্কেল-পপ করে ও হালকা লাফিয়ে ওঠে; নিচে অ্যাকসেন্ট আন্ডারলাইন বাড়ে
//  • সিন অনুযায়ী রঙের সেট (theme.ts-এর CAPTION_PALETTES), স্ট্রোক, ছায়া/দ্যুতি, হালকা ঝাপসা পটি
//  • শুধু নিচের নিরাপদ অংশে (theme.ts-এর SAFE: ০.৭৪–০.৯২ উচ্চতা, দুই পাশে ৮০px) — চরিত্র/ঘর ঢাকে না
//  • বাংলা যুক্তাক্ষর কখনো ভাঙে না: শুধু শব্দের মাঝে লাইন ভাঙে, শব্দের ভেতরে নয় (গ্রাফেম-নিরাপদ)
//  • HD (1080×1920) ও 4K (2160×3840) দুটোতেই একই চেহারা (সব মাপ ১০৮০ ভিত্তিক × স্কেল)

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  BASE_WIDTH,
  CAPTION_PALETTES,
  FONTS,
  MOTION,
  TYPE,
  layout,
  lerpColor,
  px,
  type CaptionPalette,
} from "./theme";
import { SCENES, WORDS, msToFrame } from "./scenes";

// ---------------------------------------------------------------------------
// ১) গ্রুপ তৈরি (শুধু ডেটা, মডিউল লোডের সময় একবার)
// ---------------------------------------------------------------------------
export type CaptionGroup = {
  id: number;
  sceneId: number;
  palette: number;   // scenes.ts-এর captionPalette (০–৭)
  first: number;     // WORDS-এর প্রথম সূচক
  last: number;      // WORDS-এর শেষ সূচক (অন্তর্ভুক্ত)
  showFrom: number;  // গ্রুপ পর্দায় আসে (ফ্রেম)
  showTo: number;    // গ্রুপ পর্দা ছাড়ে (ফ্রেম)
  fadeOut: number;   // বিদায়ের ফেড (ফ্রেম); ০ = সাথে সাথে বদল
};

// <<GROUPING-START>>
const MAX_WORDS = MOTION.captionWordsPerGroup.max;
const HOLD_FRAMES = msToFrame(380); // শেষ শব্দের পরেও এতক্ষণ থাকে (পরের গ্রুপ না এলে)
const MARK = /\p{M}/u;             // বাংলা কার-চিহ্ন, হসন্ত — ব্যাসার্ধ মাপতে আলাদা ধরা হয়

// শব্দের আনুমানিক প্রস্থ (em): মূল বর্ণ ~০.৬, কার/হসন্ত ~০.১৮ — একটু বেশি ধরা (নিরাপদ দিক)
const wordEm = (t: string) => {
  let base = 0;
  let marks = 0;
  for (const ch of t) (MARK.test(ch) ? marks++ : base++);
  return base * 0.6 + marks * 0.18;
};

// এক লাইনে কত em ধরে: (ক্যাপশন চওড়া ৯২০ − পটির দুই পাশে ৮৮) ÷ ৭৮ ≈ ১০.৬৭; সক্রিয় শব্দের স্কেলের জন্য ৫% ছাড়
const LINE_EM = ((BASE_WIDTH - 2 * 80 - 2 * 44) / TYPE.captionSize) * 0.95;
const GAP_EM = 0.3;

const lineCount = (from: number, to: number) => {
  let lines = 1;
  let used = 0;
  for (let i = from; i <= to; i++) {
    const w = wordEm(WORDS[i].text);
    const need = used === 0 ? w : used + GAP_EM + w;
    if (used > 0 && need > LINE_EM) {
      lines++;
      used = w;
    } else {
      used = need;
    }
  }
  return lines;
};

// গ্রুপের শেষে থাকলে অস্বস্তিকর শব্দ (পরের শব্দের সাথে জোড়া লাগা উচিত)
const DANGLING = new Set(["ও", "এবং", "তার", "তাদের", "এই", "ওই", "কিন্তু", "না", "যে", "একটি", "সেই", "প্রায়", "১০", "থেকে"]);
const SIZE_PENALTY = [0, 60, 12, 2, 0, 1]; // ১ শব্দ খুব খারাপ, ৪ সবচেয়ে ভালো

/** একটি বাক্যাংশ (a..b) কে সবচেয়ে ভালো গ্রুপে ভাঙে (DP) */
const splitRun = (a: number, b: number): [number, number][] => {
  const n = b - a + 1;
  const best: number[] = new Array(n + 1).fill(Infinity);
  const from: number[] = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 0; i < n; i++) {
    if (best[i] === Infinity) continue;
    for (let size = 1; size <= MAX_WORDS && i + size <= n; size++) {
      const gFirst = a + i;
      const gLast = a + i + size - 1;
      if (size > 1 && lineCount(gFirst, gLast) > TYPE.captionMaxLines) continue;
      const endsRun = gLast === b;
      const lastText = WORDS[gLast].text;
      let cost = 10 + SIZE_PENALTY[size];
      if (!endsRun) cost += lastText.endsWith(",") ? -6 : 8; // কমার পরে ভাঙা ভালো
      if (!endsRun && DANGLING.has(lastText)) cost += 10;
      if (best[i] + cost < best[i + size]) {
        best[i + size] = best[i] + cost;
        from[i + size] = i;
      }
    }
  }
  const out: [number, number][] = [];
  for (let end = n; end > 0; end = from[end]) out.unshift([a + from[end], a + end - 1]);
  return out;
};

const buildGroups = (): CaptionGroup[] => {
  const list: CaptionGroup[] = [];
  for (const scene of SCENES) {
    let runStart = scene.firstWord;
    for (let i = scene.firstWord; i <= scene.lastWord; i++) {
      const sentenceEnd = WORDS[i].text.endsWith("।");
      if (sentenceEnd || i === scene.lastWord) {
        for (const [first, last] of splitRun(runStart, i)) {
          list.push({
            id: list.length, sceneId: scene.id, palette: scene.captionPalette,
            first, last, showFrom: 0, showTo: 0, fadeOut: 0,
          });
        }
        runStart = i + 1;
      }
    }
  }
  // সময় বসানো: পরের গ্রুপ শুরুর POP ফ্রেম আগে বদল; ফাঁক থাকলে শেষ শব্দের পরে HOLD ফ্রেম থেকে ফেড
  const startF = (i: number) => msToFrame(WORDS[i].startMs);
  const endF = (i: number) => msToFrame(WORDS[i].endMs);
  for (let g = 0; g < list.length; g++) {
    const cur = list[g];
    const next = list[g + 1];
    const prevTo = g > 0 ? list[g - 1].showTo : 0;
    cur.showFrom = Math.max(0, startF(cur.first) - MOTION.captionPopFrames, prevTo);
    const nextIn = next ? startF(next.first) - MOTION.captionPopFrames : Infinity;
    const lastEnd = endF(cur.last);
    cur.showTo = Math.max(cur.showFrom + 1, lastEnd, Math.min(lastEnd + HOLD_FRAMES, nextIn));
    cur.fadeOut = Math.max(0, Math.min(5, cur.showTo - lastEnd));
  }
  return list;
};
// <<GROUPING-END>>

export const CAPTION_GROUPS: CaptionGroup[] = buildGroups();

// ---------------------------------------------------------------------------
// ২) ছোট হেল্পার
// ---------------------------------------------------------------------------
const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

const FONT_STACK = `${FONTS.caption}, "Hind Siliguri", "Noto Sans Bengali", "Noto Sans", sans-serif`;

// ---------------------------------------------------------------------------
// ৩) একটি শব্দ: স্ট্রোক-স্তর (পেছনে) + রঙিন স্তর (সামনে) + আন্ডারলাইন
//    -webkit-text-stroke অক্ষরের মাঝ বরাবর আঁকে, তাই আলাদা পেছনের স্তরে এঁকে ওপরে ভরাট লেখা বসানো হয়
//    (যুক্তাক্ষরের ভেতরে স্ট্রোকের দাগ দেখা যায় না)
// ---------------------------------------------------------------------------
type WordProps = {
  text: string;
  index: number;       // গ্রুপের ভেতরে ক্রম (হালকা দোল দিক বদলাতে)
  act: number;         // সক্রিয়তা ০–(১.২): স্প্রিং থেকে, ওভারশুটসহ
  sinceStart: number;  // সক্রিয় হওয়ার পর কত ফ্রেম
  p: CaptionPalette;
  scale: number;
};

const CaptionWord: React.FC<WordProps> = ({ text, index, act, sinceStart, p, scale }) => {
  const k = Math.min(1, Math.max(0, act));
  const fill = lerpColor(p.text, p.active, k);
  const popScale = 1 + (MOTION.captionActiveScale - 1) * act;
  // হালকা লাফ: সক্রিয় হওয়ার প্রথম ৯ ফ্রেমে ওপরে উঠে নামে
  const hop = sinceStart >= 0 && sinceStart < 9 ? Math.sin((sinceStart / 9) * Math.PI) : 0;
  const lift = -px(15, scale) * hop * (k > 0 ? 1 : 0);
  const tilt = (index % 2 === 0 ? -1 : 1) * 2 * Math.min(1, act) * hop;

  const common: React.CSSProperties = {
    fontFamily: FONT_STACK,
    fontSize: px(TYPE.captionSize, scale),
    fontWeight: TYPE.captionWeight,
    lineHeight: TYPE.captionLineHeight,
    letterSpacing: 0,              // বাংলায় letter-spacing দিলে যুক্তাক্ষর ভাঙে
    whiteSpace: "nowrap",          // শব্দের ভেতরে কখনো লাইন ভাঙবে না
    fontKerning: "normal",
    fontVariantLigatures: "normal",
    textRendering: "optimizeLegibility",
  };

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        transform: `translateY(${lift}px) scale(${popScale}) rotate(${tilt}deg)`,
        transformOrigin: "50% 75%",
      }}
    >
      <span
        aria-hidden
        style={{
          ...common,
          position: "absolute",
          left: 0,
          top: 0,
          color: p.stroke,
          WebkitTextStroke: `${px(TYPE.captionStroke, scale)}px ${p.stroke}`,
          textShadow: [
            `0 ${px(7, scale)}px ${px(14, scale)}px rgba(0,0,0,0.55)`,
            k > 0.01 ? `0 0 ${px(30, scale)}px ${rgba(p.glow, 0.85 * Math.min(1, k))}` : "",
          ].filter(Boolean).join(", "),
        }}
      >
        {text}
      </span>
      <span style={{ ...common, position: "relative", color: fill }}>{text}</span>
      {k > 0.01 && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "6%",
            right: "6%",
            bottom: px(-1, scale),
            height: px(7, scale),
            borderRadius: px(4, scale),
            background: p.accent,
            boxShadow: `0 0 ${px(12, scale)}px ${rgba(p.accent, 0.8)}`,
            transform: `scaleX(${Math.min(1, k)})`,
            transformOrigin: "0% 50%",
            opacity: Math.min(1, k * 1.5),
          }}
        />
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// ৪) মূল কম্পোনেন্ট
// ---------------------------------------------------------------------------
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const scale = width / BASE_WIDTH;
  const lay = layout(width, height);

  const group = CAPTION_GROUPS.find((g) => frame >= g.showFrom && frame < g.showTo);
  if (!group) return null;

  const p = CAPTION_PALETTES[group.palette] ?? CAPTION_PALETTES[0];
  const local = frame - group.showFrom;

  // গ্রুপের ঢোকা: স্প্রিং-পপ (ছোট থেকে স্বাভাবিক, নিচ থেকে ওপরে)
  const enter = spring({ frame: local, fps, config: MOTION.captionSpring });
  const enterOpacity = interpolate(local, [0, 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // বিদায়: ফাঁক থাকলে শেষ কয়েক ফ্রেমে ফেড
  const exitOpacity =
    group.fadeOut > 0
      ? interpolate(frame, [group.showTo - group.fadeOut, group.showTo], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const ids: number[] = [];
  for (let i = group.first; i <= group.last; i++) ids.push(i);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        lang="bn"
        style={{
          position: "absolute",
          left: lay.caption.left,
          top: lay.caption.top,
          width: lay.caption.width,
          height: lay.caption.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            columnGap: px(TYPE.captionSize * GAP_EM, scale),
            rowGap: px(10, scale),
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: `${px(22, scale)}px ${px(44, scale)}px`,
            borderRadius: px(48, scale),
            background: p.pill,
            backdropFilter: `blur(${px(6, scale)}px)`,
            WebkitBackdropFilter: `blur(${px(6, scale)}px)`,
            border: `${px(2, scale)}px solid rgba(255,255,255,0.10)`,
            boxShadow: `0 ${px(10, scale)}px ${px(30, scale)}px rgba(0,0,0,0.25)`,
            opacity: enterOpacity * exitOpacity,
            transform: `translateY(${(1 - enter) * px(34, scale)}px) scale(${0.86 + 0.14 * enter})`,
            transformOrigin: "50% 100%",
          }}
        >
          {ids.map((wi, idx) => {
            // সক্রিয় হওয়ার ফ্রেম: শব্দ বলার captionLeadMs আগে; শেষ হয় পরের শব্দের সক্রিয় হওয়ায় (শেষ শব্দ: গ্রুপ ছাড়া পর্যন্ত)
            const aStart = msToFrame(WORDS[wi].startMs - MOTION.captionLeadMs);
            const aEnd = wi < group.last ? msToFrame(WORDS[wi + 1].startMs - MOTION.captionLeadMs) : Infinity;
            const sinceStart = frame - aStart;
            const inAmt = sinceStart < 0 ? 0 : spring({ frame: sinceStart, fps, config: MOTION.captionSpring });
            const outAmt = frame < aEnd ? 1 : interpolate(frame, [aEnd, aEnd + 4], [1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <CaptionWord
                key={wi}
                text={WORDS[wi].text}
                index={idx}
                act={inAmt * outAmt}
                sinceStart={sinceStart}
                p={p}
                scale={scale}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
