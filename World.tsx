// World.tsx — ধাপ ৪: 3D জগৎ (পরিবেশ, আলো, ক্যামেরা)
// ব্যবহার: <Sequence from={startFrame} durationInFrames={n}><World sceneId={id}>{চরিত্র}</World></Sequence>
// World নিজে useCurrentFrame() (সিনের স্থানীয় ফ্রেম) থেকে গ্লোবাল ফ্রেম ও ক্যামেরার অগ্রগতি বের করে।
// children (ধাপ ৫-এর চরিত্র) একই 3D ক্যানভাসের ভেতরে বসে।
// সব অ্যানিমেশন ফ্রেম-নির্ভর (useFrame নয়), তাই রেন্ডার নির্ধারিত (deterministic)।

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BASE_WIDTH, COLORS, MOODS, MOTION, blendMood, lerpColor, type MoodTheme } from "./theme";
import { FPS, SCENES, sceneRange, type Scene } from "./scenes";

export type Vec3 = [number, number, number];

// ---------------------------------------------------------------------------
// হেল্পার
// ---------------------------------------------------------------------------
/** নির্ধারিত (seeded) র‍্যান্ডম — প্রতি রেন্ডারে একই ফল */
export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = Easing.out(Easing.cubic);

let _grad: THREE.DataTexture | null = null;
/** টুন (cel-shaded) গ্রেডিয়েন্ট — ৪ ধাপের আলো-ছায়া */
export const getToonGradient = () => {
  if (!_grad) {
    _grad = new THREE.DataTexture(new Uint8Array([70, 140, 210, 255]), 4, 1, THREE.RedFormat);
    _grad.minFilter = THREE.NearestFilter;
    _grad.magFilter = THREE.NearestFilter;
    _grad.needsUpdate = true;
  }
  return _grad;
};

// ---------------------------------------------------------------------------
// Part — আউটলাইনসহ টুন মেশ (চরিত্রেও (ধাপ ৫) এটাই ব্যবহার হবে)
// ---------------------------------------------------------------------------
export type GeoKind = "box" | "cyl" | "cone" | "sphere";

const Geo: React.FC<{ kind: GeoKind; args: number[] }> = ({ kind, args }) => {
  switch (kind) {
    case "box":
      return <boxGeometry args={args as [number, number, number]} />;
    case "cyl": // [উপরের ব্যাসার্ধ, নিচের ব্যাসার্ধ, উচ্চতা, বিভাজন]
      return <cylinderGeometry args={args as [number, number, number, number]} />;
    case "cone": // [ব্যাসার্ধ, উচ্চতা, বিভাজন]
      return <coneGeometry args={args as [number, number, number]} />;
    default: // [ব্যাসার্ধ, প্রস্থ-বিভাজন, উচ্চতা-বিভাজন]
      return <sphereGeometry args={args as [number, number, number]} />;
  }
};

export type PartProps = {
  geo: GeoKind;
  args: number[];
  color: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  emissive?: string;
  emissiveIntensity?: number;
  outline?: number; // 0 = আউটলাইন নেই
  children?: React.ReactNode;
};

export const Part: React.FC<PartProps> = ({
  geo, args, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1],
  emissive = "#000000", emissiveIntensity = 0, outline = 0.04, children,
}) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh>
      <Geo kind={geo} args={args} />
      <meshToonMaterial color={color} gradientMap={getToonGradient()} emissive={emissive} emissiveIntensity={emissiveIntensity} />
    </mesh>
    {outline > 0 && (
      <mesh scale={1 + outline}>
        <Geo kind={geo} args={args} />
        <meshBasicMaterial color="#05060f" side={THREE.BackSide} />
      </mesh>
    )}
    {children}
  </group>
);

// ---------------------------------------------------------------------------
// আকাশ, তারা, চাঁদ, মেঘ, পাখি
// ---------------------------------------------------------------------------
const Sky: React.FC<{ top: string; bottom: string }> = ({ top, bottom }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = clamp(vP.y * 1.6 + 0.12, 0.0, 1.0); h = pow(h, 0.7);
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  mat.uniforms.top.value.set(top);
  mat.uniforms.bottom.value.set(bottom);
  return (
    <mesh renderOrder={-10} material={mat}>
      <sphereGeometry args={[480, 24, 16]} />
    </mesh>
  );
};

const Stars: React.FC<{ opacity: number; frame: number; scale: number }> = ({ opacity, frame, scale }) => {
  const geo = useMemo(() => {
    const r = rng(7);
    const n = 520;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2;
      const ph = Math.acos(0.12 + r() * 0.88);
      p[i * 3] = 450 * Math.sin(ph) * Math.cos(th);
      p[i * 3 + 1] = 450 * Math.cos(ph);
      p[i * 3 + 2] = 450 * Math.sin(ph) * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  if (opacity <= 0.01) return null;
  return (
    <points geometry={geo} frustumCulled={false}>
      <pointsMaterial color="#ffffff" size={2.4 * scale} sizeAttenuation={false} transparent
        opacity={opacity * (0.8 + 0.2 * Math.sin(frame * 0.15))} depthWrite={false} fog={false} />
    </points>
  );
};

const Moon: React.FC<{ visible: number; skyTop: string }> = ({ visible, skyTop }) => (
  <group position={[-18, 44, -150]}>
    <mesh>
      <sphereGeometry args={[8, 32, 24]} />
      <meshBasicMaterial color={lerpColor(skyTop, COLORS.moon, visible)} fog={false} toneMapped={false} />
    </mesh>
    {[
      [-2.4, 2.2, 1.3], [2.6, -1.4, 1.8], [0.6, 3.6, 0.9], [-3.2, -2.6, 1.1], [3.4, 2.8, 0.8],
    ].map(([x, y, r], i) => (
      <mesh key={i} position={[x, y, 7.4]} scale={[1, 1, 0.15]}>
        <sphereGeometry args={[r, 12, 8]} />
        <meshBasicMaterial color="#c6d3f0" transparent opacity={0.55 * visible} fog={false} toneMapped={false} />
      </mesh>
    ))}
    {[1.25, 1.6, 2.2].map((k, i) => (
      <mesh key={i} scale={k}>
        <sphereGeometry args={[8, 24, 16]} />
        <meshBasicMaterial color={COLORS.moonGlow} transparent opacity={[0.16, 0.09, 0.05][i] * visible}
          depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
    ))}
  </group>
);

const Clouds: React.FC<{ frame: number; fog: string }> = ({ frame, fog }) => {
  const items = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 7 }, (_, i) => ({
      x: -110 + i * 36 + r() * 10, y: 26 + r() * 16, z: -100 - r() * 50, s: 0.9 + r() * 0.9,
    }));
  }, []);
  const col = lerpColor(fog, "#ffffff", 0.25);
  return (
    <>
      {items.map((c, i) => (
        <group key={i} position={[((c.x + frame * 0.04 + 130) % 260) - 130, c.y, c.z]} scale={c.s}>
          {[[0, 0, 9], [8, 1, 7], [-8, 0.5, 7], [4, 3, 6], [-3, 3.5, 6]].map(([x, y, r], j) => (
            <mesh key={j} position={[x, y, 0]} scale={[1.5, 0.7, 0.8]}>
              <sphereGeometry args={[r, 12, 8]} />
              <meshBasicMaterial color={col} transparent opacity={0.55} depthWrite={false} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
};

const Birds: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {Array.from({ length: 7 }, (_, i) => {
      const x = -80 + ((frame * 0.35 + i * 23) % 160);
      const y = 24 + i * 1.6 + Math.sin(frame * 0.05 + i) * 0.8;
      const flap = Math.sin(frame * 0.4 + i * 1.3) * 0.6;
      return (
        <group key={i} position={[x, y, -62 - i * 4]} scale={1.6}>
          <mesh position={[-0.55, 0, 0]} rotation={[0, 0, 0.3 + flap]}>
            <boxGeometry args={[1.1, 0.05, 0.35]} />
            <meshBasicMaterial color="#0b0d1c" />
          </mesh>
          <mesh position={[0.55, 0, 0]} rotation={[0, 0, -(0.3 + flap)]}>
            <boxGeometry args={[1.1, 0.05, 0.35]} />
            <meshBasicMaterial color="#0b0d1c" />
          </mesh>
        </group>
      );
    })}
  </>
);

// ---------------------------------------------------------------------------
// মাটি, ফসলি জমি, ধানের গুচ্ছ, মেঠো পথ, পুকুর
// ---------------------------------------------------------------------------
/** মেঠো পথের বিন্দু — ভিটার ডান পাশ ঘেঁষে দূরের গ্রামের দিকে (Scenes.tsx-এও ব্যবহার হয়) */
export const PATH_PTS = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(5.8, 0, 10), new THREE.Vector3(5.8, 0, -2), new THREE.Vector3(4.5, 0, -12),
    new THREE.Vector3(-3, 0, -22), new THREE.Vector3(-12, 0, -32), new THREE.Vector3(-22, 0, -42),
    new THREE.Vector3(-32, 0, -52),
  ],
  false, "catmullrom", 0.4,
).getPoints(70);

const nearPath = (x: number, z: number, w: number) => {
  for (const p of PATH_PTS) if (Math.hypot(p.x - x, p.z - z) < w) return true;
  return false;
};

const Ground: React.FC = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[800, 800]} />
    <meshToonMaterial color="#4a3a28" gradientMap={getToonGradient()} />
  </mesh>
);

/** ফসলি জমির টুকরো (patchwork) — পাকা সোনালি আর কাঁচা সবুজ মিশে */
const PaddyFields: React.FC = () => {
  const plots = useMemo(() => {
    const r = rng(5);
    const out: { x: number; z: number; color: string }[] = [];
    for (let ix = -3; ix <= 3; ix++)
      for (let iz = -4; iz <= 1; iz++)
        out.push({ x: ix * 28, z: iz * 22 - 4, color: lerpColor("#5f8f3a", "#d2b94c", 0.25 + r() * 0.65) });
    return out;
  }, []);
  return (
    <>
      {plots.map((p, i) => (
        <mesh key={i} position={[p.x, 0.02, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[25, 19]} />
          <meshToonMaterial color={p.color} gradientMap={getToonGradient()} />
        </mesh>
      ))}
    </>
  );
};

/** ধানের গুচ্ছ — বাতাসে দোলে */
const Tufts: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const r = rng(21);
    const arr: { x: number; z: number; s: number; yaw: number; ph: number; c: number; col: THREE.Color }[] = [];
    while (arr.length < 2400) {
      const x = (r() - 0.5) * 90;
      const z = -44 + r() * 80;
      if (Math.hypot(x, z) < 9.5 || nearPath(x, z, 1.4)) continue;
      const c = r();
      arr.push({ x, z, s: 0.7 + r() * 0.8, yaw: r() * 6.28, ph: r() * 6.28, c, col: new THREE.Color(lerpColor("#5f8f3a", "#d8bd4a", clamp01(0.25 + c * 0.9))) });
    }
    return arr;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.28, 1.1, 5);
    g.translate(0, 0.55, 0);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshToonMaterial({ gradientMap: getToonGradient() }), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new THREE.Object3D();
    const t = frame / FPS;
    data.forEach((q, i) => {
      d.position.set(q.x, 0.02, q.z);
      d.rotation.set(Math.cos(t * 1.5 + q.ph) * 0.06, q.yaw, Math.sin(t * 1.7 + q.x * 0.25 + q.z * 0.18) * 0.14);
      d.scale.set(q.s, q.s * (0.9 + 0.3 * q.c), q.s);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, q.col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, mat, data.length]} frustumCulled={false} />;
};

const Clearing: React.FC<{ radius: number }> = ({ radius }) => (
  <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <circleGeometry args={[radius, 40]} />
    <meshToonMaterial color="#8a6a48" gradientMap={getToonGradient()} />
  </mesh>
);

const DirtPath: React.FC = () => {
  const segs = useMemo(() => {
    const out: { x: number; z: number; len: number; rot: number }[] = [];
    for (let i = 0; i < PATH_PTS.length - 1; i++) {
      const a = PATH_PTS[i], b = PATH_PTS[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      out.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len: Math.hypot(dx, dz) + 0.15, rot: Math.atan2(dx, dz) });
    }
    return out;
  }, []);
  return (
    <>
      {segs.map((s, i) => (
        <group key={i} position={[s.x, 0.045, s.z]} rotation={[0, s.rot, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.7, s.len]} />
            <meshToonMaterial color="#b08a62" gradientMap={getToonGradient()} />
          </mesh>
        </group>
      ))}
    </>
  );
};

const Pond: React.FC<{ frame: number }> = ({ frame }) => (
  <group position={[-9, 0.08, 6]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[4.2, 2.6, 1]}>
      <circleGeometry args={[1, 32]} />
      <meshStandardMaterial color="#2c4f8a" roughness={0.25} emissive="#1a2f66" emissiveIntensity={0.35 + 0.05 * Math.sin(frame * 0.08)} />
    </mesh>
    <mesh position={[0.4, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.5 + 0.04 * Math.sin(frame * 0.1), 1.8, 1]}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial color={COLORS.moon} transparent opacity={0.35} />
    </mesh>
    {[[-3.6, 0.6], [-3.2, -0.7], [3.5, 0.9], [3.9, -0.4]].map(([x, z], i) => (
      <Part key={i} geo="cone" args={[0.1, 1.6, 4]} position={[x, 0.8, z]} rotation={[0, 0, Math.sin(frame * 0.05 + i) * 0.08]} color="#4f7a34" outline={0} />
    ))}
  </group>
);

// ---------------------------------------------------------------------------
// গাছ (তাল/নারকেল, বড় গাছ) ও পেঁচা
// ---------------------------------------------------------------------------
const Palm: React.FC<{ position: Vec3; h: number; lean: number; frame: number; seed: number }> = ({ position, h, lean, frame, seed }) => (
  <group position={position} rotation={[0, seed, lean]}>
    <Part geo="cyl" args={[0.16, 0.28, h, 6]} position={[0, h / 2, 0]} color="#6b4a32" outline={0.05} />
    <group position={[0, h, 0]} rotation={[0, 0, -lean * 0.5]}>
      {Array.from({ length: 7 }, (_, i) => (
        <group key={i} rotation={[0, (i / 7) * Math.PI * 2, 0]}>
          <Part geo="cone" args={[0.5, 3.4, 4]}
            position={[0, 0.5, 1.5]}
            rotation={[1.25 + Math.sin(frame * 0.04 + i + seed) * 0.05, 0, 0]}
            scale={[1.4, 1, 0.25]} color="#2f6b3a" outline={0.04} />
        </group>
      ))}
    </group>
  </group>
);

const Trees: React.FC<{ frame: number }> = ({ frame }) => {
  const items = useMemo(() => {
    const r = rng(33);
    const out: { x: number; z: number; h: number; lean: number; seed: number }[] = [];
    while (out.length < 14) {
      const a = r() * Math.PI * 2;
      const d = 14 + r() * 32;
      const x = Math.sin(a) * d * 0.8, z = Math.cos(a) * d - 8;
      if (nearPath(x, z, 3)) continue;
      out.push({ x, z, h: 5 + r() * 3, lean: (r() - 0.5) * 0.18, seed: r() * 6.28 });
    }
    return out;
  }, []);
  return (
    <>
      {items.map((t, i) => (
        <Palm key={i} position={[t.x, 0, t.z]} h={t.h} lean={t.lean} frame={frame} seed={t.seed} />
      ))}
    </>
  );
};

/** শিরোনাম-দৃশ্যের বড় গাছ ও (ঐচ্ছিক) পেঁচা */
const BigTree: React.FC<{ owl: boolean; frame: number }> = ({ owl, frame }) => {
  const blink = frame % 110 < 4 ? 0.1 : 1;
  return (
    <group position={[-2.0, 0, 4.5]}>
      <Part geo="cyl" args={[0.35, 0.55, 7, 8]} position={[0, 3.5, 0]} color="#4a3322" />
      <Part geo="cyl" args={[0.12, 0.2, 3.2, 6]} position={[1.5, 4.5, 0]} rotation={[0, 0, Math.PI / 2 - 0.12]} color="#4a3322" />
      {[[0, 8, 0, 2.4], [-1.6, 7.2, 0.4, 1.9], [1.2, 7.6, -0.4, 1.8], [0.2, 9.2, 0.2, 1.6]].map(([x, y, z, r], i) => (
        <Part key={i} geo="sphere" args={[r, 14, 10]} position={[x, y, z]} color="#1f4a32" outline={0.03} />
      ))}
      {owl && (
        <group position={[2.6, 4.75, 0]} rotation={[0, -0.25, 0]}>
          <Part geo="sphere" args={[0.35, 14, 10]} position={[0, 0.1, 0]} scale={[1, 1.3, 0.9]} color="#8a6a4a" />
          <Part geo="sphere" args={[0.3, 14, 10]} position={[0, 0.7, 0.05]} color="#9a7a56" />
          <Part geo="cone" args={[0.08, 0.2, 4]} position={[-0.2, 1.0, 0.05]} color="#6a4a32" outline={0.05} />
          <Part geo="cone" args={[0.08, 0.2, 4]} position={[0.2, 1.0, 0.05]} color="#6a4a32" outline={0.05} />
          {[-0.12, 0.12].map((x, i) => (
            <Part key={i} geo="sphere" args={[0.1, 10, 8]} position={[x, 0.72, 0.28]} scale={[1, blink, 1]}
              color="#ffd23f" emissive="#ffb300" emissiveIntensity={1.2} outline={0.1} />
          ))}
          <Part geo="cone" args={[0.05, 0.12, 4]} position={[0, 0.62, 0.36]} rotation={[1.57, 0, 0]} color="#e08a2a" outline={0} />
        </group>
      )}
    </group>
  );
};

// ---------------------------------------------------------------------------
// ঘরবাড়ি
// ---------------------------------------------------------------------------
const WindowGlow = (lit: number) => ({ emissive: COLORS.lantern, emissiveIntensity: 0.15 + 1.5 * lit });

/** মাটির দেয়াল, খড়ের চালের ছোট ঘর (সামনে +z) */
export const Hut: React.FC<{ position: Vec3; rotY?: number; scale?: number; lit?: number }> = ({ position, rotY = 0, scale = 1, lit = 0.7 }) => (
  <group position={position} rotation={[0, rotY, 0]} scale={scale}>
    <Part geo="box" args={[3.2, 1.8, 2.4]} position={[0, 0.9, 0]} color="#8d6847" />
    <Part geo="cone" args={[2.9, 1.7, 4]} position={[0, 2.65, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.15, 1, 0.82]} color={COLORS.thatch} />
    <Part geo="box" args={[0.75, 1.25, 0.06]} position={[-0.7, 0.65, 1.21]} color="#2b1b12" outline={0} />
    <Part geo="box" args={[0.55, 0.5, 0.06]} position={[0.85, 1.1, 1.21]} color="#ffcf7a" outline={0.06} {...WindowGlow(lit)} />
    <Part geo="box" args={[1.4, 0.12, 0.5]} position={[-0.7, 0.06, 1.45]} color="#7a5a3c" outline={0} />
  </group>
);

/** বড় একান্নবর্তী বাড়ি */
const BigHouse: React.FC<{ position: Vec3; lit: number }> = ({ position, lit }) => (
  <group position={position}>
    <Part geo="box" args={[7, 2.2, 4.4]} position={[0, 1.1, 0]} color="#9a7350" />
    <Part geo="cone" args={[4.6, 2.1, 4]} position={[0, 3.25, 0]} rotation={[0, Math.PI / 4, 0]} scale={[1.35, 1, 0.95]} color={COLORS.thatch} />
    <Part geo="box" args={[1.1, 1.7, 0.06]} position={[0, 0.85, 2.21]} color="#2b1b12" outline={0} />
    {[-2.3, 2.3].map((x, i) => (
      <Part key={i} geo="box" args={[0.8, 0.7, 0.06]} position={[x, 1.3, 2.21]} color="#ffcf7a" outline={0.06} {...WindowGlow(lit)} />
    ))}
    {[-3.2, -1.1, 1.1, 3.2].map((x, i) => (
      <Part key={i} geo="cyl" args={[0.09, 0.09, 2.2, 6]} position={[x, 1.1, 2.7]} color="#6b4a32" outline={0.08} />
    ))}
    <Part geo="box" args={[7, 0.12, 1.2]} position={[0, 0.06, 2.6]} color="#7a5a3c" outline={0} />
  </group>
);

const Courtyard: React.FC<{ radius?: number }> = ({ radius = 6 }) => (
  <mesh position={[0, 0.08, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
    <circleGeometry args={[radius, 40]} />
    <meshToonMaterial color="#a68560" gradientMap={getToonGradient()} />
  </mesh>
);

const Tulsi: React.FC<{ position: Vec3 }> = ({ position }) => (
  <group position={position}>
    <Part geo="cyl" args={[0.3, 0.22, 0.5, 8]} position={[0, 0.25, 0]} color="#b5603a" />
    <Part geo="sphere" args={[0.3, 10, 8]} position={[0, 0.75, 0]} scale={[1, 1.2, 1]} color="#3f8f4a" />
  </group>
);

/** গ্রাম: ছড়ানো ছোট ঘর আর আলো জ্বলা জানালা */
const Village: React.FC<{ far?: boolean }> = ({ far }) => {
  const huts = useMemo(() => {
    const r = rng(far ? 61 : 41);
    const n = far ? 7 : 9;
    return Array.from({ length: n }, () =>
      far
        ? { x: -40 + r() * 22, z: -52 - r() * 14, rot: r() - 0.5, s: 0.9 + r() * 0.3 }
        : { x: (r() - 0.5) * 20, z: -14 - r() * 28, rot: (r() - 0.5) * 1.2, s: 0.8 + r() * 0.3 },
    ).filter((h) => !nearPath(h.x, h.z, 3));
  }, [far]);
  return (
    <>
      {huts.map((h, i) => (
        <Hut key={i} position={[h.x, 0, h.z]} rotY={h.rot} scale={h.s} lit={0.9} />
      ))}
    </>
  );
};

const EmptyLand: React.FC = () => (
  <>
    <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[7.5, 36]} />
      <meshToonMaterial color="#7a6a3a" gradientMap={getToonGradient()} />
    </mesh>
    {[[-5, 2], [4.5, 3], [-2, -4], [5, -3], [0, 4.5], [-6, -1]].map(([x, z], i) => (
      <Part key={i} geo="cone" args={[0.25, 0.9, 4]} position={[x, 0.45, z]} color="#8a8a3a" outline={0} />
    ))}
  </>
);

/** ভিটার তিনটি ঘর (পতিত জমিতে ধীরে ধীরে উঠে আসে: build 0→1) */
const ThreeHuts: React.FC<{ baseY: number; progress: number; build: boolean; lit: number }> = ({ baseY, progress, build, lit }) => {
  const spec: { p: Vec3; r: number }[] = [
    { p: [-2.6, baseY, 0.6], r: 0.2 },
    { p: [0.2, baseY, -2.2], r: -0.05 },
    { p: [2.7, baseY, 0.3], r: -0.25 },
  ];
  return (
    <>
      {spec.map((h, i) => {
        const b = build ? easeOut(clamp01((progress - 0.2 - i * 0.2) / 0.3)) : 1;
        if (b <= 0.01) return null;
        return <Hut key={i} position={h.p} rotY={h.r} scale={0.8 * b} lit={lit * b} />;
      })}
    </>
  );
};

const Mound: React.FC = () => (
  <>
    <Part geo="cyl" args={[6, 8, 0.9, 36]} position={[0, 0.45, 0]} color="#6e4d33" outline={0.02} />
    <mesh position={[0, 0.91, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[6, 36]} />
      <meshToonMaterial color="#8a6a48" gradientMap={getToonGradient()} />
    </mesh>
  </>
);

const Bamboo: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {[[-8, -2], [-8.6, -1.2], [-7.4, -1], [8.2, -2.5], [8.8, -1.6], [7.6, -1.9]].map(([x, z], i) => (
      <Part key={i} geo="cyl" args={[0.07, 0.1, 6.5, 6]} position={[x, 3.2, z]}
        rotation={[0, 0, (x < 0 ? -0.08 : 0.08) + Math.sin(frame * 0.03 + i) * 0.02]} color={COLORS.bamboo} outline={0.1} />
    ))}
  </>
);

const ThatchPile: React.FC = () => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <Part key={i} geo="box" args={[1.6, 0.18, 0.5]} position={[-5.4, 0.12 + i * 0.18, 2.6]} rotation={[0, 0.2 + i * 0.1, 0]} color="#c9a44a" outline={0.05} />
    ))}
  </>
);

// ---------------------------------------------------------------------------
// আলো ও আবহের জিনিস: হারিকেন, জোনাকি, কুয়াশা, ধোঁয়া, মালা, ছায়া
// ---------------------------------------------------------------------------
const Lantern: React.FC<{ position: Vec3; frame: number; glowOnly: boolean }> = ({ position, frame, glowOnly }) => {
  const fl = 0.92 + 0.08 * Math.sin(frame * 0.7) + 0.04 * Math.sin(frame * 1.9);
  return (
    <group position={position}>
      {!glowOnly && (
        <>
          <Part geo="cyl" args={[0.01, 0.01, 0.5, 4]} position={[0, 0.45, 0]} color="#222" outline={0} />
          <Part geo="box" args={[0.24, 0.38, 0.24]} color="#ffd98a" emissive={COLORS.lantern} emissiveIntensity={1.6 * fl} outline={0.1} />
        </>
      )}
      <mesh scale={0.9 * fl + (glowOnly ? 0.6 : 0)}>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshBasicMaterial color={COLORS.lantern} transparent opacity={glowOnly ? 0.35 : 0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
};

const Fireflies: React.FC<{ frame: number }> = ({ frame }) => {
  const items = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 36 }, () => ({ x: (r() - 0.5) * 40, y: 0.6 + r() * 2.8, z: (r() - 0.5) * 30, ph: r() * 6.28, sp: 0.4 + r() * 0.8 }));
  }, []);
  const t = frame / FPS;
  return (
    <>
      {items.map((f, i) => (
        <mesh key={i} position={[f.x + Math.sin(t * f.sp + f.ph) * 1.2, f.y + Math.sin(t * f.sp * 1.7 + f.ph) * 0.4, f.z + Math.cos(t * f.sp + f.ph) * 1.2]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshBasicMaterial color="#d8ff7a" transparent opacity={0.25 + 0.75 * Math.max(0, Math.sin(t * 2.2 * f.sp + f.ph))} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
};

const FogLayers: React.FC<{ color: string; frame: number }> = ({ color, frame }) => (
  <>
    {[0.7, 1.5, 2.4, 3.4].map((y, i) => (
      <mesh key={i} position={[Math.sin(frame * 0.004 + i * 2) * 6, y, Math.cos(frame * 0.003 + i) * 4]} rotation={[-Math.PI / 2, 0, i]}>
        <planeGeometry args={[130, 130]} />
        <meshBasicMaterial color={color} transparent opacity={0.1 + i * 0.012} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    ))}
  </>
);

const Smoke: React.FC<{ position: Vec3; frame: number }> = ({ position, frame }) => (
  <>
    {Array.from({ length: 6 }, (_, i) => {
      const t = (frame * 0.012 + i / 6) % 1;
      return (
        <mesh key={i} position={[position[0] + t * 1.5 + Math.sin(t * 6 + i) * 0.25, position[1] + t * 5, position[2]]} scale={0.3 + t * 1.2}>
          <sphereGeometry args={[0.5, 10, 8]} />
          <meshBasicMaterial color="#b8bfd0" transparent opacity={(1 - t) * 0.35} depthWrite={false} />
        </mesh>
      );
    })}
  </>
);

/** বিয়ের গাঁদা-ফুলের তোরণ ও মালা */
const WeddingArch: React.FC<{ position: Vec3 }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 0.2, 0]}>
      <torusGeometry args={[1.5, 0.09, 8, 24, Math.PI]} />
      <meshToonMaterial color="#e89b2a" gradientMap={getToonGradient()} />
    </mesh>
    {Array.from({ length: 15 }, (_, i) => {
      const a = (i / 14) * Math.PI;
      return (
        <mesh key={i} position={[Math.cos(a) * 1.5, 0.2 + Math.sin(a) * 1.5, 0]}>
          <sphereGeometry args={[0.15, 8, 6]} />
          <meshToonMaterial color={i % 2 ? "#ff9a1f" : "#ffd23f"} gradientMap={getToonGradient()} />
        </mesh>
      );
    })}
    <Part geo="cyl" args={[0.06, 0.06, 1.7, 6]} position={[-1.5, 0.85, 0]} color="#7a5a3c" outline={0.1} />
    <Part geo="cyl" args={[0.06, 0.06, 1.7, 6]} position={[1.5, 0.85, 0]} color="#7a5a3c" outline={0.1} />
  </group>
);

const Marigold: React.FC = () => (
  <>
    {[-1, 1].map((sx) =>
      Array.from({ length: 8 }, (_, i) => (
        <mesh key={`${sx}${i}`} position={[sx * (2.2 + i * 0.35), 2.5 - Math.sin((i / 7) * Math.PI) * 0.4, -1.2]}>
          <sphereGeometry args={[0.14, 8, 6]} />
          <meshToonMaterial color={i % 2 ? "#ff9a1f" : "#ffd23f"} gradientMap={getToonGradient()} />
        </mesh>
      )),
    )}
  </>
);

const DoorGlow: React.FC<{ position: Vec3 }> = ({ position }) => (
  <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[1.5, 2.6]} />
    <meshBasicMaterial color={COLORS.lantern} transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
  </mesh>
);

const LongShadow: React.FC<{ frame: number }> = ({ frame }) => (
  <mesh position={[-2.2, 0.1, 1.6]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[1.2 + 0.05 * Math.sin(frame * 0.05), 3.4, 1]}>
    <circleGeometry args={[1, 24]} />
    <meshBasicMaterial color="#000000" transparent opacity={0.42} depthWrite={false} />
  </mesh>
);

const ClothBundle: React.FC = () => (
  <group position={[1.8, 0, 1.8]}>
    <Part geo="sphere" args={[0.35, 12, 8]} position={[0, 0.32, 0]} scale={[1.1, 0.9, 1]} color="#c97a3a" />
    <Part geo="sphere" args={[0.12, 8, 6]} position={[0, 0.7, 0]} color="#c97a3a" outline={0.06} />
  </group>
);

// ---------------------------------------------------------------------------
// ক্যামেরা, আলো, ওভারলে
// ---------------------------------------------------------------------------
const CameraRig: React.FC<{ scene: Scene; progress: number; frame: number }> = ({ scene, progress, frame }) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    const e = Easing.inOut(Easing.cubic)(progress);
    const c = scene.camera;
    let pos: Vec3;
    let look: Vec3;
    if (c.type === "orbit") {
      const a = THREE.MathUtils.degToRad(c.fromDeg + (c.toDeg - c.fromDeg) * e);
      pos = [c.center[0] + Math.sin(a) * c.radius, c.height, c.center[2] + Math.cos(a) * c.radius];
      look = c.center;
    } else {
      pos = lerp3(c.from, c.to, e);
      look = c.look;
    }
    const t = frame / FPS; // হালকা হাতে-ধরা ক্যামেরার কাঁপন
    camera.position.set(pos[0] + Math.sin(t * 0.9) * 0.06, pos[1] + Math.cos(t * 0.7) * 0.05, pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    camera.updateProjectionMatrix();
  });
  return null;
};

const Lights: React.FC<{ m: MoodTheme; lanternPos: Vec3; lanternOn: boolean; frame: number }> = ({ m, lanternPos, lanternOn, frame }) => {
  const fl = 0.92 + 0.08 * Math.sin(frame * 0.7) + 0.04 * Math.sin(frame * 1.9);
  return (
    <>
      <ambientLight color={m.ambient} intensity={m.ambientIntensity * 1.6} />
      <directionalLight color={m.keyColor} intensity={m.keyIntensity * 2.2} position={[-20, 40, 25]} />
      <pointLight color={COLORS.lantern} intensity={lanternOn ? m.lanternIntensity * 25 * fl : 0} distance={22} decay={2} position={lanternPos} />
    </>
  );
};

/** ভিগনেট + ফিল্ম-গ্রেইন (CSS, 3D-র ওপরে) */
export const MoodOverlay: React.FC<{ m: MoodTheme; frame: number; scale: number }> = ({ m, frame, scale }) => {
  const noise = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0'/></filter><rect width='200' height='200' filter='url(#n)'/></svg>`,
  )}")`;
  return (
    <>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 48%, rgba(2,4,16,${m.vignette}) 100%)`, pointerEvents: "none" }} />
      <AbsoluteFill style={{
        backgroundImage: noise, backgroundSize: `${200 * scale}px ${200 * scale}px`,
        backgroundPosition: `${(frame * 37) % 200}px ${(frame * 91) % 200}px`,
        opacity: m.grain, mixBlendMode: "overlay", pointerEvents: "none",
      }} />
    </>
  );
};

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
const moodFor = (scene: Scene, local: number): MoodTheme => {
  const prev = SCENES[scene.id - 2];
  if (!prev || prev.mood === scene.mood) return MOODS[scene.mood];
  return blendMood(prev.mood, scene.mood, clamp01(local / MOTION.sceneFadeFrames));
};

export type WorldProps = { sceneId: number; children?: React.ReactNode };

export const World: React.FC<WorldProps> = ({ sceneId, children }) => {
  const local = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scene = SCENES[sceneId - 1];
  const r = sceneRange(scene);
  const frame = r.startFrame + local;
  const progress = clamp01(local / Math.max(1, r.endFrame - r.startFrame));
  const m = moodFor(scene, local);
  const scale = width / BASE_WIDTH;
  const has = (p: string) => scene.props.includes(p);

  const hasMound = has("homestead-mound");
  const hasThreeHuts = has("three-huts") || hasMound;
  const baseY = hasMound ? 0.9 : 0;
  const lanternOn = has("lantern") || has("lantern-glow");
  const lanternPos: Vec3 = has("big-house") ? [3.0, 2.2, -1.4] : hasThreeHuts ? [1.5, baseY + 2.0, 1.6] : [2.2, 2.0, -1.6];

  return (
    <AbsoluteFill style={{ filter: `saturate(${m.grade.saturation}) contrast(${m.grade.contrast})` }}>
      <ThreeCanvas width={width} height={height} style={{ width, height }}
        camera={{ fov: 62, near: 0.1, far: 700, position: [0, 2, 14] }}>
        <fog attach="fog" args={[m.fog, m.fogNear, m.fogFar]} />
        <CameraRig scene={scene} progress={progress} frame={frame} />
        <Lights m={m} lanternPos={lanternPos} lanternOn={lanternOn} frame={frame} />

        {/* আকাশ (সব দৃশ্যে) */}
        <Sky top={m.skyTop} bottom={m.skyBottom} />
        <Stars opacity={m.starsVisible} frame={frame} scale={scale} />
        <Moon visible={m.moonVisible} skyTop={m.skyTop} />
        <Clouds frame={frame} fog={m.fog} />
        {has("birds") && <Birds frame={frame} />}

        {/* মাটি ও ফসলি জমি */}
        <Ground />
        <PaddyFields />
        <Tufts frame={frame} />
        <Clearing radius={9} />
        {(has("path") || has("dirt-path")) && <DirtPath />}
        {has("pond") && <Pond frame={frame} />}
        {has("trees") && <Trees frame={frame} />}
        {has("tree") && <BigTree owl={has("owl")} frame={frame} />}

        {/* গ্রাম */}
        {has("village") && <Village />}
        {(has("village-far") || has("other-houses-far")) && <Village far />}

        {/* উঠান ও ঘর */}
        {(has("courtyard") || has("big-house")) && <Courtyard />}
        {has("courtyard") && <Tulsi position={[-3.2, 0.08, -0.6]} />}
        {has("hut") && !hasMound && <Hut position={[0, 0, -3.4]} lit={0.8} />}
        {has("big-house") && <BigHouse position={[0, 0, -4.2]} lit={0.8} />}
        {has("big-house") && has("smoke") && <Smoke position={[2.2, 3.6, -4.4]} frame={frame} />}
        {has("empty-land") && <EmptyLand />}
        {hasMound && <Mound />}
        {hasThreeHuts && <ThreeHuts baseY={baseY} progress={progress} build={has("empty-land")} lit={0.8} />}
        {has("bamboo") && <Bamboo frame={frame} />}
        {has("thatch") && <ThatchPile />}

        {/* প্রপস */}
        {has("wedding-garland") && <WeddingArch position={[0, 0, -1.8]} />}
        {has("marigold") && <Marigold />}
        {has("doorway") && <DoorGlow position={[0, 0.12, -0.8]} />}
        {has("shadow") && <LongShadow frame={frame} />}
        {has("cloth-bundle") && <ClothBundle />}
        {lanternOn && <Lantern position={lanternPos} frame={frame} glowOnly={!has("lantern")} />}

        {/* আবহ */}
        {has("fireflies") && <Fireflies frame={frame} />}
        {has("fog") && <FogLayers color={m.fog} frame={frame} />}

        {children}
      </ThreeCanvas>
      <MoodOverlay m={m} frame={frame} scale={scale} />
    </AbsoluteFill>
  );
};
