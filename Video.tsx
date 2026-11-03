// Video.tsx — ধাপ ৭: মূল ভিডিও কম্পোজিশন (সিন সিকোয়েন্স + ক্রসফেড + অডিও + ক্যাপশন)
// ব্যবহার: Root.tsx-এর দুটি Composition (Story-HD, Story-4K) একই <Video /> চালায়; মাপ বদলায়, বাকি সব হুবহু এক।
//
// স্তর (নিচ থেকে ওপরে):
//   ১) পটভূমি (গভীর রাতের রঙ) — ফেড-ইন/আউটের সময় কালো না দেখিয়ে থিমের রঙ দেখায়
//   ২) ১৩টি সিন (Scenes.tsx-এর StoryScene), প্রতিটি নিজের সময়ে; পরের সিন আগের সিনের ওপর নরমভাবে ফুটে ওঠে (ক্রসফেড)
//   ৩) শেষের ফেড-আউট
//   ৪) ক্যাপশন (Captions.tsx) — সবার ওপরে, সিনের ফেডে ঝাপসা হয় না
//   + অডিও: story01.mp3 (ভয়েসওভার), শুরু ফ্রেম ০ থেকে

import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame } from "remotion";
import story from "./story01.mp3";
import { COLORS, MOTION } from "./theme";
import { SCENES, TOTAL_FRAMES, sceneRange } from "./scenes";
import { StoryScene } from "./Scenes";
import { Captions } from "./Captions";

const FADE = MOTION.sceneFadeFrames;   // সিনের ক্রসফেড (১২ ফ্রেম) — World-এর আবহ-মিশ্রণের সময়ের সাথে মেলে
const OPEN_FADE = 10;                  // শুরুতে থিমের রঙ থেকে ফুটে ওঠা
const CLOSE_FADE = 24;                 // শেষে থিমের রঙে মিলিয়ে যাওয়া (শেষ ১ সেকেন্ড ফাঁকা অংশে)

/** সিনের প্রথম FADE ফ্রেমে ০→১ স্বচ্ছতা; আগের সিনের ওপর বসে বলে ক্রসফেড হয় */
const SceneFadeIn: React.FC<{ frames: number; children: React.ReactNode }> = ({ frames, children }) => {
  const local = useCurrentFrame();
  const opacity = interpolate(local, [0, frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/** শেষের ফেড-আউট পর্দা */
const CloseFade: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [TOTAL_FRAMES - CLOSE_FADE, TOTAL_FRAMES - 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ backgroundColor: COLORS.ink, opacity }} />;
};

export const Video: React.FC = () => {
  const last = SCENES.length - 1;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink }}>
      <Audio src={story} />

      {SCENES.map((scene, i) => {
        const r = sceneRange(scene);
        // সিনের নিজের সময় + পরের সিন ওপরে ফুটে ওঠার জন্য আরও FADE ফ্রেম (এ সময় ক্যামেরা শেষ অবস্থানে থামে)।
        // শেষ সিন চলে একেবারে ভিডিওর শেষ পর্যন্ত (শেষের ১ সেকেন্ড ফাঁকা দৃশ্যসহ)।
        const duration = i === last ? TOTAL_FRAMES - r.startFrame : r.endFrame - r.startFrame + FADE;
        return (
          <Sequence key={scene.id} from={r.startFrame} durationInFrames={duration} name={`সিন ${scene.id}`}>
            <SceneFadeIn frames={i === 0 ? OPEN_FADE : FADE}>
              <StoryScene sceneId={scene.id} />
            </SceneFadeIn>
          </Sequence>
        );
      })}

      <CloseFade />
      <Captions />
    </AbsoluteFill>
  );
};
