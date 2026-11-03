// Root.tsx — ধাপ ৭: দুটি Composition — Story-HD (1080×1920) ও Story-4K (2160×3840), ৩০ fps
// দৈর্ঘ্য scenes.ts-এর TOTAL_FRAMES (অডিও ৭০.২৭ সে + শেষে ১ সে = ২১৩৯ ফ্রেম)। index.ts এটিকে registerRoot করে।

import React from "react";
import { Composition } from "remotion";
import { FORMATS, type FormatKey } from "./theme";
import { FPS, TOTAL_FRAMES } from "./scenes";
import { Video } from "./Video";

export const RemotionRoot: React.FC = () => (
  <>
    {(Object.keys(FORMATS) as FormatKey[]).map((key) => (
      <Composition
        key={FORMATS[key].id}
        id={FORMATS[key].id}
        component={Video}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={FORMATS[key].width}
        height={FORMATS[key].height}
      />
    ))}
  </>
);
