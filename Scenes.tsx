// Scenes.tsx — ধাপ ৫: প্রতিটি সিনের চরিত্র-বিন্যাস, হাঁটা, আসা-যাওয়া ও স্থান/সাল কার্ড
// ব্যবহার (ধাপ ৭-এ): <Sequence from={startFrame} durationInFrames={n}><StoryScene sceneId={id} /></Sequence>
// চরিত্ররা গল্পের শব্দের সাথে সিঙ্কে আসে — যেমন "প্রহ্লাদ বিশ্বাস" বলার মুহূর্তে প্রহ্লাদ স্প্রিং-পপে হাজির হয়।

import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, MOTION, TYPE, layout, px } from "./theme";
import { FPS, SCENES, WORDS, msToFrame, sceneRange } from "./scenes";
import { PATH_PTS, World, type Vec3 } from "./World";
import { Character, type CharId, type Pose } from "./Characters";

type Place = {
  who: CharId;
  pos: Vec3;
  rotY?: number;
  scale?: number;
  pose?: Pose;
  appearWord?: number;                                   // এই শব্দ বলার সময় হাজির হবে
  walk?: { fromWord: number; to: Vec3; rotY: number };   // এই শব্দ থেকে সিন-শেষ পর্যন্ত হেঁটে (to) তে যাবে
  pathWalk?: { from: number; to: number };               // মেঠো পথ (PATH_PTS) ধরে হাঁটবে
};

// শব্দ-সূচক: scenes.ts-এর WORDS অনুযায়ী
const CAST_BY_SCENE: Record<number, Place[]> = {
  // ৩: "এই গ্রামেই প্রহ্লাদ(16) বিশ্বাস, তার স্ত্রী(19), তার তিন ছেলে প্রভাষ(23), পঙ্কজ(24) ও প্রকাশ(26)"
  3: [
    { who: "prohlad",  pos: [-0.7, 0, -0.7], rotY: 0.1,  appearWord: 16 },
    { who: "wife",     pos: [0.7, 0, -0.7],  rotY: -0.1, appearWord: 19 },
    { who: "prabhash", pos: [-1.7, 0, 0.7],  rotY: 0.15, appearWord: 23 },
    { who: "pankaj",   pos: [0, 0, 0.9],     rotY: 0,    appearWord: 24 },
    { who: "prokash",  pos: [1.7, 0, 0.7],   rotY: -0.15, appearWord: 26 },
  ],
  // ৪: "প্রভাসের(27) বয়স পঁয়ত্রিশ, পঙ্কজের(30) বয়স তিরিশের কাছাকাছি"
  4: [
    { who: "prabhash", pos: [-0.9, 0, 0], rotY: 0.25,  appearWord: 27 },
    { who: "pankaj",   pos: [0.9, 0, 0],  rotY: -0.25, appearWord: 30 },
  ],
  // ৫: "বড় এবং মেজো ছেলেকে প্রহ্লাদ বিশ্বাস বিয়ে(40) দিয়েছেন" — বউরা বিয়ে বলার সময় আসে
  5: [
    { who: "prohlad",  pos: [-0.6, 0, -0.9], rotY: 0.1 },
    { who: "wife",     pos: [0.6, 0, -0.9],  rotY: -0.1 },
    { who: "prabhash", pos: [-2.0, 0, 0.2],  rotY: 0.2 },
    { who: "bou1",     pos: [-1.0, 0, 0.2],  rotY: -0.1, appearWord: 40 },
    { who: "pankaj",   pos: [1.0, 0, 0.2],   rotY: 0.1 },
    { who: "bou2",     pos: [2.0, 0, 0.2],   rotY: -0.2, appearWord: 40 },
  ],
  // ৬: একান্নবর্তী পরিবার — সবাই উঠানে
  6: [
    { who: "prohlad",  pos: [-3.0, 0, 0.4], rotY: 0.3 },
    { who: "wife",     pos: [-2.0, 0, 0.5], rotY: 0.2 },
    { who: "prabhash", pos: [-0.8, 0, 0.4], rotY: 0.1 },
    { who: "bou1",     pos: [0.2, 0, 0.5],  rotY: 0 },
    { who: "pankaj",   pos: [1.4, 0, 0.4],  rotY: -0.1 },
    { who: "bou2",     pos: [2.4, 0, 0.5],  rotY: -0.2 },
    { who: "prokash",  pos: [3.5, 0, 0.4],  rotY: -0.3 },
  ],
  // ৭: অমিল — বউরা রাগী, বাবা-মা-প্রকাশ মনখারাপ; "ছেলে(62) প্রকাশকে নিয়ে" শুনে তিনজন হেঁটে বেরিয়ে যায়
  7: [
    { who: "bou1",    pos: [1.6, 0, 0.2],  rotY: -1.0, pose: "angry" },
    { who: "bou2",    pos: [2.5, 0, 0.5],  rotY: -1.1, pose: "angry" },
    { who: "prohlad", pos: [-1.6, 0, 0.6], rotY: 1.0,  pose: "sad",  walk: { fromWord: 62, to: [-6.0, 0, 2.2], rotY: -1.45 } },
    { who: "wife",    pos: [-0.6, 0, 0.7], rotY: 1.0,  pose: "sad",  walk: { fromWord: 62, to: [-5.1, 0, 2.5], rotY: -1.45 } },
    { who: "prokash", pos: [-1.1, 0, 1.4], rotY: 0.8,  pose: "sad",  walk: { fromWord: 62, to: [-5.6, 0, 3.0], rotY: -1.45 } },
  ],
  // ৮: পতিত জমিতে ঘর ওঠা দেখছে
  8: [
    { who: "prohlad", pos: [-4.0, 0, 1.8], rotY: 1.9 },
    { who: "wife",    pos: [-3.2, 0, 2.0], rotY: 1.9 },
    { who: "prokash", pos: [-3.6, 0, 1.2], rotY: 1.9 },
  ],
  // ১১: প্রহ্লাদ মেঠো পথ ধরে দূরের গ্রামের দিকে হাঁটছেন (দূর থেকে ছোট দেখায় বলে বড় করা)
  11: [{ who: "prohlad", pos: [0, 0, 0], scale: 2.0, pose: "walk", pathWalk: { from: 2, to: 58 } }],
  // ১৩: ভিটার ওপর একটি মাত্র পরিবার — "প্রহ্লাদ(128) বিশ্বাস, তার স্ত্রী(131) এবং তার সন্তান(134)"
  13: [
    { who: "prohlad", pos: [-0.8, 0.9, 1.0], rotY: 0,    appearWord: 128 },
    { who: "wife",    pos: [0.0, 0.9, 1.1],  rotY: 0,    appearWord: 131 },
    { who: "prokash", pos: [0.8, 0.9, 1.0],  rotY: -0.1, appearWord: 134 },
  ],
};

const wordFrame = (i: number) => msToFrame(WORDS[i].startMs);
const ease = Easing.inOut(Easing.cubic);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** একটি সিনের সব চরিত্র (World-এর children হিসেবে 3D ক্যানভাসের ভেতরে বসে) */
export const Cast: React.FC<{ sceneId: number; frame: number }> = ({ sceneId, frame }) => {
  const places = CAST_BY_SCENE[sceneId] ?? [];
  const range = sceneRange(SCENES[sceneId - 1]);
  return (
    <>
      {places.map((p, i) => {
        let pos = p.pos;
        let rotY = p.rotY ?? 0;
        let pose: Pose = p.pose ?? "idle";
        const scale = p.scale ?? 1;
        let walkPhase: number | undefined;

        if (p.walk) {
          const f0 = wordFrame(p.walk.fromWord);
          if (frame >= f0) {
            const k = ease(clamp01((frame - f0) / Math.max(1, range.endFrame - f0)));
            pos = [
              p.pos[0] + (p.walk.to[0] - p.pos[0]) * k,
              p.pos[1] + (p.walk.to[1] - p.pos[1]) * k,
              p.pos[2] + (p.walk.to[2] - p.pos[2]) * k,
            ];
            rotY = p.walk.rotY;
            pose = "walk";
          }
        }

        if (p.pathWalk) {
          const k = clamp01((frame - range.startFrame) / Math.max(1, range.endFrame - range.startFrame));
          const f = p.pathWalk.from + (p.pathWalk.to - p.pathWalk.from) * k;
          const a = PATH_PTS[Math.min(PATH_PTS.length - 2, Math.floor(f))];
          const b = PATH_PTS[Math.min(PATH_PTS.length - 1, Math.floor(f) + 1)];
          const u = f - Math.floor(f);
          pos = [a.x + (b.x - a.x) * u, 0, a.z + (b.z - a.z) * u];
          rotY = Math.atan2(b.x - a.x, b.z - a.z);
          pose = "walk";
          walkPhase = frame * 0.18;
        }

        return (
          <Character
            key={`${p.who}-${i}`}
            who={p.who}
            position={pos}
            rotY={rotY}
            scale={scale}
            pose={pose}
            frame={frame}
            walkPhase={walkPhase}
            appearFrame={p.appearWord !== undefined ? wordFrame(p.appearWord) - 2 : undefined}
          />
        );
      })}
    </>
  );
};

/** পর্দায় ভেসে ওঠা স্থান/সাল লেখা (যেমন "১৯৭৬", "লাহুরিয়া • লোহাগাড়া • নড়াইল") */
const Card: React.FC<{ text: string; local: number }> = ({ text, local }) => {
  const { width, height } = useVideoConfig();
  const s = width / 1080;
  const inStart = 6;
  const inEnd = inStart + MOTION.cardInFrames;
  const holdEnd = inEnd + Math.round((MOTION.cardHoldMs / 1000) * FPS);
  const outEnd = holdEnd + 10;
  if (local < inStart || local > outEnd) return null;
  const aIn = clamp01((local - inStart) / MOTION.cardInFrames);
  const aOut = 1 - clamp01((local - holdEnd) / 10);
  const a = Easing.out(Easing.cubic)(aIn) * aOut;
  const len = [...text].length;
  const size = len <= 6 ? TYPE.cardSize * 1.5 : len <= 14 ? TYPE.cardSize * 0.8 : TYPE.cardSizeSmall * 0.85;
  const L = layout(width, height);
  return (
    <AbsoluteFill style={{ alignItems: "center", pointerEvents: "none" }}>
      <div style={{
        position: "absolute", top: L.card.top, left: px(80, s), right: px(80, s),
        textAlign: "center", opacity: a, transform: `translateY(${(1 - aIn) * px(24, s)}px) scale(${0.96 + 0.04 * aIn})`,
        filter: `blur(${(1 - aIn) * px(6, s)}px)`,
      }}>
        <div style={{
          fontFamily: FONTS.card, fontSize: px(size, s), lineHeight: 1.25, color: COLORS.moon,
          textShadow: `0 0 ${px(26, s)}px ${COLORS.lantern}99, 0 ${px(4, s)}px ${px(14, s)}px #000b`,
        }}>{text}</div>
        <div style={{
          margin: `${px(14, s)}px auto 0`, width: "55%", height: px(3, s),
          background: `linear-gradient(90deg, transparent, ${COLORS.lantern}, transparent)`, opacity: 0.9,
        }} />
      </div>
    </AbsoluteFill>
  );
};

/** একটি সম্পূর্ণ সিন: 3D জগৎ + চরিত্র + কার্ড */
export const StoryScene: React.FC<{ sceneId: number }> = ({ sceneId }) => {
  const local = useCurrentFrame();
  const scene = SCENES[sceneId - 1];
  const frame = sceneRange(scene).startFrame + local;
  return (
    <AbsoluteFill>
      <World sceneId={sceneId}>
        <Cast sceneId={sceneId} frame={frame} />
      </World>
      {scene.card && <Card text={scene.card} local={local} />}
    </AbsoluteFill>
  );
};
