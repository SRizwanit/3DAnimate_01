// Characters.tsx — ধাপ ৫: চরিত্র (low-poly, cel-shaded 3D)
// সাতটি চরিত্র: প্রহ্লাদ, স্ত্রী, প্রভাষ, পঙ্কজ, প্রকাশ, বড় বউ (bou1), মেজো বউ (bou2)
// সব অ্যানিমেশন ফ্রেম-নির্ভর। মূল (০,০,০) = পায়ের তলা। সামনে = +z।

import React from "react";
import { spring } from "remotion";
import { COLORS } from "./theme";
import { FPS, type Cast } from "./scenes";
import { Part, type Vec3 } from "./World";

export type CharId = Cast;
export type Pose = "idle" | "walk" | "sad" | "angry" | "talk";

type CharSpec = {
  kind: "man" | "woman";
  height: number;          // আপেক্ষিক উচ্চতা
  bulk: number;            // শরীরের চওড়াভাব
  skin: string;
  top: string;             // জামা / শাড়ির ওপরের অংশ
  bottom: string;          // লুঙ্গি / প্যান্ট / শাড়ির নিচের অংশ
  accent?: string;         // গামছা / শাড়ির আঁচল
  hair: string;
  hairStyle: "black" | "whiteBald" | "bun" | "veil";
  mustache?: string;
  skirt: boolean;          // লুঙ্গি/শাড়ি (পা ঢাকা) হলে true
  stoop: number;           // সামনে ঝুঁকে থাকা (বয়স্কদের জন্য)
  seed: number;
};

export const CHARS: Record<CharId, CharSpec> = {
  prohlad:  { kind: "man",   height: 1.0,  bulk: 0.95, skin: COLORS.skin[2], top: "#f1eee4", bottom: "#3b5a8a", accent: "#c94a4a", hair: "#e9e9f0", hairStyle: "whiteBald", mustache: "#dcdce6", skirt: true,  stoop: 0.1,  seed: 1.1 },
  wife:     { kind: "woman", height: 0.93, bulk: 1.0,  skin: COLORS.skin[1], top: "#d9ccaa", bottom: "#d9ccaa", accent: "#b23a3a", hair: "#cfcfd8", hairStyle: "bun",       skirt: true,  stoop: 0.08, seed: 2.3 },
  prabhash: { kind: "man",   height: 1.04, bulk: 1.12, skin: COLORS.skin[1], top: "#2f6f8f", bottom: "#6b3f8f", hair: "#1c1612", hairStyle: "black", mustache: "#1c1612", skirt: true,  stoop: 0.03, seed: 3.7 },
  pankaj:   { kind: "man",   height: 1.02, bulk: 1.0,  skin: COLORS.skin[0], top: "#d0a23a", bottom: "#2f3b52", hair: "#1c1612", hairStyle: "black", mustache: "#1c1612", skirt: false, stoop: 0.02, seed: 4.9 },
  prokash:  { kind: "man",   height: 0.98, bulk: 0.95, skin: COLORS.skin[0], top: "#3f8f5f", bottom: "#2f3b52", hair: "#1c1612", hairStyle: "black",                     skirt: false, stoop: 0.0,  seed: 6.1 },
  bou1:     { kind: "woman", height: 0.94, bulk: 0.95, skin: COLORS.skin[0], top: "#c43a4a", bottom: "#c43a4a", accent: "#ffd23f", hair: "#1c1612", hairStyle: "veil", skirt: true,  stoop: 0.02, seed: 7.4 },
  bou2:     { kind: "woman", height: 0.92, bulk: 0.95, skin: COLORS.skin[1], top: "#e07a3a", bottom: "#e07a3a", accent: "#ffd23f", hair: "#1c1612", hairStyle: "veil", skirt: true,  stoop: 0.02, seed: 8.8 },
};

const UNIT = 0.87; // মূল মাপ → প্রায় ১.৭ একক উচ্চতা

export type CharacterProps = {
  who: CharId;
  position: Vec3;
  rotY?: number;          // 0 = +z (ক্যামেরার দিকে) মুখ
  scale?: number;
  pose?: Pose;
  frame: number;          // গ্লোবাল ফ্রেম
  appearFrame?: number;   // এই ফ্রেমে স্প্রিং-পপ করে আসবে (না দিলে শুরু থেকেই আছে)
  walkPhase?: number;     // হাঁটার ফেজ (rad); না দিলে frame থেকে
};

export const Character: React.FC<CharacterProps> = ({
  who, position, rotY = 0, scale = 1, pose = "idle", frame, appearFrame, walkPhase,
}) => {
  const c = CHARS[who];
  if (appearFrame !== undefined && frame < appearFrame) return null;
  const pop =
    appearFrame === undefined
      ? 1
      : spring({ frame: frame - appearFrame, fps: FPS, config: { damping: 11, stiffness: 140, mass: 0.7 } });

  const t = frame / FPS;
  const sd = c.seed;
  const walking = pose === "walk";
  const phase = walkPhase ?? t * 5.4;
  const sw = walking ? Math.sin(phase) : 0;
  const bob = walking ? Math.abs(Math.sin(phase)) * 0.035 : Math.sin(t * 2 + sd) * 0.006;

  // ভঙ্গি
  let armL = Math.sin(t * 1.3 + sd) * 0.04;
  let armR = -armL;
  let lean = c.stoop;
  let headX = Math.sin(t * 0.6 + sd) * 0.03;
  let headY = Math.sin(t * 0.7 + sd) * 0.12;
  let mouthOpen = 0;
  let browTilt = 0;
  if (pose === "walk") {
    armL = -sw * 0.55;
    armR = sw * 0.55;
    headY *= 0.3;
  } else if (pose === "sad") {
    armL = 0.12;
    armR = 0.12;
    lean += 0.14;
    headX = 0.35 + Math.sin(t * 0.8 + sd) * 0.03;
    headY *= 0.5;
    browTilt = -0.25;
  } else if (pose === "angry") {
    armR = -1.3 + Math.sin(t * 6 + sd) * 0.35;
    armL = -0.7 + Math.sin(t * 5 + sd) * 0.25;
    headY = Math.sin(t * 5 + sd) * 0.18;
    mouthOpen = Math.abs(Math.sin(t * 9 + sd)) * 0.035;
    browTilt = 0.3;
  } else if (pose === "talk") {
    armR = -0.5 + Math.sin(t * 3 + sd) * 0.3;
    headX = Math.sin(t * 3) * 0.05;
    mouthOpen = Math.abs(Math.sin(t * 8 + sd)) * 0.03;
  }
  const blink = (frame + Math.round(sd * 17)) % 120 < 4 ? 0.1 : 1;
  const breathe = 1 + Math.sin(t * 2 + sd) * 0.012;
  const b = c.bulk;

  return (
    <group position={position} rotation={[0, rotY, 0]} scale={UNIT * c.height * scale * pop}>
      <group position={[0, bob, 0]}>
        {/* পা / লুঙ্গি / শাড়ি */}
        {c.skirt ? (
          <>
            <Part geo="cyl" args={[c.kind === "woman" ? 0.2 : 0.2, c.kind === "woman" ? 0.34 : 0.28, 0.8, 12]}
              position={[0, 0.42, 0]} rotation={[0, 0, sw * 0.04]} scale={[b, 1, b]} color={c.bottom} />
            {[-0.1, 0.1].map((x, i) => (
              <Part key={i} geo="box" args={[0.13, 0.07, 0.26]}
                position={[x, 0.035, 0.08 + (i ? -sw : sw) * 0.14]} color="#2a1d16" outline={0.05} />
            ))}
          </>
        ) : (
          [-0.12, 0.12].map((x, i) => (
            <group key={i} position={[x, 0.82, 0]} rotation={[(i ? -sw : sw) * 0.6, 0, 0]}>
              <Part geo="cyl" args={[0.09, 0.075, 0.8, 8]} position={[0, -0.4, 0]} color={c.bottom} />
              <Part geo="box" args={[0.13, 0.07, 0.26]} position={[0, -0.8, 0.06]} color="#2a1d16" outline={0.05} />
            </group>
          ))
        )}

        {/* ধড় (কোমর-পিভট) */}
        <group position={[0, 0.82, 0]} rotation={[lean, 0, 0]}>
          <group scale={[1, breathe, 1]}>
            <Part geo="cyl" args={[0.2, 0.24, 0.66, 12]} position={[0, 0.33, 0]} scale={[b, 1, b * 0.85]} color={c.top} />
            {c.accent && c.kind === "woman" && (
              // আঁচল (কাঁধ থেকে বুকের ওপর দিয়ে)
              <Part geo="box" args={[0.16, 0.7, 0.05]} position={[-0.06, 0.34, 0.2 * b]} rotation={[0, 0, -0.35]} color={c.accent} outline={0.05} />
            )}
            {c.accent && c.kind === "man" && (
              // গামছা
              <Part geo="cyl" args={[0.045, 0.045, 0.62, 6]} position={[0.02, 0.42, 0.02]} rotation={[0, 0, 1.15]} scale={[1, 1, 1.6]} color={c.accent} outline={0.08} />
            )}
          </group>

          {/* হাত */}
          {[-1, 1].map((side) => {
            const ax = side < 0 ? armL : armR;
            return (
              <group key={side} position={[side * 0.3 * b, 0.6, 0]} rotation={[ax, 0, side * 0.1]}>
                <Part geo="cyl" args={[0.068, 0.06, 0.58, 8]} position={[0, -0.29, 0]} color={c.kind === "man" ? c.top : c.skin} />
                {c.kind === "woman" && <Part geo="cyl" args={[0.07, 0.066, 0.26, 8]} position={[0, -0.13, 0]} color={c.top} outline={0.04} />}
                <Part geo="sphere" args={[0.07, 8, 6]} position={[0, -0.62, 0]} color={c.skin} outline={0.06} />
              </group>
            );
          })}

          {/* গলা */}
          <Part geo="cyl" args={[0.07, 0.08, 0.12, 8]} position={[0, 0.7, 0]} color={c.skin} outline={0.05} />

          {/* মাথা */}
          <group position={[0, 0.9, 0]} rotation={[headX, headY, 0]}>
            <Part geo="sphere" args={[0.2, 16, 12]} scale={[1, 1.08, 1]} color={c.skin} />
            {[-1, 1].map((s) => (
              <Part key={s} geo="sphere" args={[0.045, 8, 6]} position={[s * 0.2, 0, 0]} color={c.skin} outline={0.06} />
            ))}
            {/* চোখ */}
            {[-1, 1].map((s) => (
              <group key={s} position={[s * 0.075, 0.03, 0]} scale={[1, blink, 1]}>
                <Part geo="sphere" args={[0.045, 8, 6]} position={[0, 0, 0.165]} color="#ffffff" outline={0} />
                <Part geo="sphere" args={[0.026, 8, 6]} position={[0, 0, 0.2]} color="#14100c" outline={0} />
              </group>
            ))}
            {/* ভুরু */}
            {[-1, 1].map((s) => (
              <Part key={s} geo="box" args={[0.075, 0.016, 0.01]} position={[s * 0.075, 0.105, 0.185]} rotation={[0, 0, s * browTilt]}
                color={c.hairStyle === "whiteBald" ? "#cfcfd8" : "#1c1612"} outline={0} />
            ))}
            {/* নাক, মুখ */}
            <Part geo="cone" args={[0.035, 0.09, 4]} position={[0, -0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]} color={c.skin} outline={0} />
            <Part geo="box" args={[0.09, 0.014 + mouthOpen, 0.01]} position={[0, -0.095, 0.185]} color="#6a1f1f" outline={0} />
            {c.mustache && <Part geo="box" args={[0.15, 0.03, 0.04]} position={[0, -0.062, 0.19]} color={c.mustache} outline={0} />}
            {c.kind === "woman" && <Part geo="sphere" args={[0.012, 6, 4]} position={[0, 0.09, 0.2]} color="#c43a3a" outline={0} />}

            {/* চুল */}
            {c.hairStyle === "black" && (
              <Part geo="sphere" args={[0.21, 14, 10]} position={[0, 0.04, -0.045]} scale={[1.02, 0.95, 1.05]} color={c.hair} />
            )}
            {c.hairStyle === "bun" && (
              <>
                <Part geo="sphere" args={[0.21, 14, 10]} position={[0, 0.04, -0.045]} scale={[1.02, 0.95, 1.05]} color={c.hair} />
                <Part geo="sphere" args={[0.1, 10, 8]} position={[0, 0.14, -0.2]} color={c.hair} />
              </>
            )}
            {c.hairStyle === "whiteBald" && (
              <>
                {[-1, 1].map((s) => (
                  <Part key={s} geo="sphere" args={[0.075, 8, 6]} position={[s * 0.17, 0.02, -0.03]} color={c.hair} outline={0.06} />
                ))}
                <Part geo="sphere" args={[0.12, 10, 8]} position={[0, 0.0, -0.14]} scale={[1.4, 0.8, 0.8]} color={c.hair} outline={0.04} />
              </>
            )}
            {c.hairStyle === "veil" && (
              <>
                {/* ঘোমটা: মুখ খোলা রেখে মাথা ও পিঠ ঢাকে */}
                <Part geo="sphere" args={[0.245, 14, 10]} position={[0, 0.03, -0.075]} scale={[1.05, 1.1, 1.1]} color={c.top} />
                <Part geo="cone" args={[0.3, 0.6, 10]} position={[0, -0.4, -0.16]} rotation={[-0.15, 0, 0]} color={c.top} outline={0.03} />
                {c.accent && <Part geo="sphere" args={[0.02, 6, 4]} position={[0, 0.17, 0.2]} color={c.accent} emissive={c.accent} emissiveIntensity={0.4} outline={0} />}
              </>
            )}
          </group>
        </group>
      </group>
    </group>
  );
};
