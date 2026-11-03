// scenes.ts — ধাপ ২: গল্পের সিন ব্রেকডাউন ও অডিও-সিঙ্ক করা শব্দ-টাইমিং
// টাইমিং কীভাবে ঠিক হয়েছে: story1.json-এর সময় অডিওর চেয়ে ~১.৫ গুণ ধীর ছিল (১০৬.৫ সে বনাম ৭০.২৭ সে)।
// story01.mp3 এর নীরবতা (silence) ধরে প্রতিটি বাক্যের শেষ ও পরের বাক্যের শুরু অ্যাঙ্কর করা হয়েছে,
// মাঝের শব্দগুলো অ্যাঙ্করের মাঝে রৈখিকভাবে (piecewise-linear) স্কেল করা হয়েছে। সব সময় মিলিসেকেন্ডে।

export const FPS = 30;
export const AUDIO_MS = 70270; // story01.mp3 এর দৈর্ঘ্য
export const TAIL_FRAMES = FPS; // শেষে ১ সেকেন্ড ফাঁকা দৃশ্য
export const TOTAL_FRAMES = Math.ceil((AUDIO_MS / 1000) * FPS) + TAIL_FRAMES;

export type Word = { text: string; startMs: number; endMs: number };

// [শব্দ, শুরু ms, শেষ ms] — বানান সংশোধিত (কাছাকাছি, দূরে)
const RAW: [string, number, number][] = [
  ["ঘটনাটির", 0, 563],
  ["সময়", 745, 1864],
  ["উনিশশো", 2466, 2799],
  ["ছিয়াত্তর", 3132, 3521],
  ["সাল।", 3711, 4005],
  ["নড়াইল", 4913, 5230],
  ["জেলার", 5440, 5679],
  ["লোহাগাড়া", 5933, 6284],
  ["উপজেলার", 6551, 6924],
  ["লাহুরিয়া", 7198, 7514],
  ["ইউনিয়নের", 7795, 8147],
  ["ছোট্ট", 8351, 8646],
  ["গ্রাম", 8934, 9251],
  ["লাহুরিয়া।", 9539, 10045],
  ["এই", 10831, 10999],
  ["গ্রামেই", 11216, 11517],
  ["প্রহ্লাদ", 11777, 12099],
  ["বিশ্বাস,", 12393, 12688],
  ["তার", 12898, 13073],
  ["স্ত্রী,", 13318, 13648],
  ["তার", 13935, 14089],
  ["তিন", 14257, 14460],
  ["ছেলে", 14671, 14895],
  ["প্রভাষ,", 15175, 15561],
  ["পঙ্কজ", 15841, 16198],
  ["ও", 16317, 16443],
  ["প্রকাশ।", 16696, 17060],
  ["প্রভাসের", 17623, 17914],
  ["বয়স", 18059, 18301],
  ["পঁয়ত্রিশ,", 18626, 19055],
  ["পঙ্কজের", 19256, 19533],
  ["বয়স", 19692, 19906],
  ["তিরিশের", 20190, 20474],
  ["কাছাকাছি।", 20695, 21228],
  ["বড়", 21739, 21925],
  ["এবং", 22087, 22248],
  ["মেজো", 22428, 22608],
  ["ছেলেকে", 22829, 23069],
  ["প্রহ্লাদ", 23261, 23500],
  ["বিশ্বাস", 23728, 23962],
  ["বিয়ে", 24123, 24315],
  ["দিয়েছেন।", 24561, 24872],
  ["একান্নবর্তী", 25345, 25791],
  ["পরিবারে", 26046, 26350],
  ["তাদের", 26555, 26754],
  ["বসবাস।", 27058, 27398],
  ["কিন্তু", 28010, 28249],
  ["ছেলের", 28458, 28691],
  ["বউ", 28911, 29175],
  ["এবং", 29359, 29549],
  ["ছেলের", 29727, 29954],
  ["পরিবারের", 30217, 30493],
  ["সাথে", 30652, 30842],
  ["প্রহ্লাদ", 31032, 31271],
  ["বিশ্বাস", 31498, 31750],
  ["ও", 31866, 31958],
  ["তার", 32099, 32228],
  ["স্ত্রীর", 32448, 32675],
  ["বনিবনা", 32939, 33215],
  ["না", 33386, 33552],
  ["হওয়ায়", 33803, 34104],
  ["ছোট", 34318, 34490],
  ["ছেলে", 34674, 34864],
  ["প্রকাশকে", 35109, 35409],
  ["নিয়ে", 35550, 35740],
  ["তাদের", 35906, 36071],
  ["বাড়ি", 36267, 36464],
  ["থেকে", 36623, 36801],
  ["কিছুটা", 37052, 37285],
  ["দূরে", 37536, 37775],
  ["তাদেরই", 38070, 38321],
  ["দীর্ঘদিন", 38603, 38885],
  ["ধরে", 39044, 39204],
  ["পতিত", 39406, 39620],
  ["থাকা", 39786, 39982],
  ["একটি", 40154, 40344],
  ["জমিতে", 40589, 40816],
  ["তিনটি", 41030, 41239],
  ["ঘর", 41392, 41564],
  ["নির্মাণ", 41815, 42054],
  ["করেন।", 42281, 42514],
  ["ওই", 43030, 43194],
  ["জমির", 43363, 43555],
  ["চতুরদিকে", 43809, 44126],
  ["রয়েছে", 44289, 44498],
  ["ফসলি", 44713, 44922],
  ["জমি।", 45114, 45300],
  ["সেটি", 45757, 45918],
  ["আসলে", 46063, 46229],
  ["কোনো", 46375, 46536],
  ["গ্রাম", 46711, 46872],
  ["নয়।", 47053, 47189],
  ["গ্রামটা", 47608, 47887],
  ["ফসলি", 48114, 48354],
  ["জমির", 48535, 48788],
  ["ঠিক", 48969, 49157],
  ["পাশে।", 49391, 49656],
  ["যেখানে", 50147, 50396],
  ["ঘর", 50577, 50729],
  ["নির্মাণ", 50927, 51153],
  ["করেন", 51294, 51458],
  ["প্রহ্লাদ", 51638, 51870],
  ["বিশ্বাস,", 52073, 52322],
  ["সেখান", 52565, 52791],
  ["থেকে", 52926, 53090],
  ["অন্য", 53259, 53429],
  ["বাড়িগুলোতে", 53706, 54005],
  ["যেতে", 54214, 54406],
  ["পায়ে", 54592, 54768],
  ["হেঁটে", 54943, 55123],
  ["প্রায়", 55321, 55524],
  ["১০", 55705, 55869],
  ["থেকে", 55999, 56163],
  ["১৫", 56343, 56541],
  ["মিনিট", 56705, 56919],
  ["সময়", 57072, 57236],
  ["লাগে।", 57439, 57654],
  ["বলতে", 58119, 58347],
  ["পারেন", 58545, 58761],
  ["যে", 58917, 59085],
  ["ওই", 59253, 59432],
  ["চতুরদিকে", 59690, 60026],
  ["ফসলি", 60278, 60506],
  ["জমির", 60680, 60908],
  ["মাঝখানে", 61208, 61514],
  ["একটি", 61742, 61951],
  ["ভিটা।", 62179, 62455],
  ["সেখানে", 63104, 63403],
  ["প্রহ্লাদ", 63624, 63917],
  ["বিশ্বাস,", 64144, 64456],
  ["তার", 64658, 64820],
  ["স্ত্রী", 65145, 65451],
  ["এবং", 65672, 65879],
  ["তার", 66029, 66198],
  ["সন্তানকে", 66471, 66744],
  ["নিয়ে", 66906, 67127],
  ["একটি", 67348, 67563],
  ["মাত্র", 67758, 67985],
  ["পরিবার", 68252, 68525],
  ["সেখানে", 68746, 69012],
  ["বসবাস", 69279, 69558],
  ["করে।", 69773, 70000],
];

export const WORDS: Word[] = RAW.map(([text, startMs, endMs]) => ({ text, startMs, endMs }));

export const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);

// ---------------------------------------------------------------------------
// সিন
// ---------------------------------------------------------------------------
export type CameraMove =
  | { type: "push"; from: [number, number, number]; to: [number, number, number]; look: [number, number, number] }
  | { type: "pan"; from: [number, number, number]; to: [number, number, number]; look: [number, number, number] }
  | { type: "orbit"; center: [number, number, number]; radius: number; height: number; fromDeg: number; toDeg: number }
  | { type: "crane"; from: [number, number, number]; to: [number, number, number]; look: [number, number, number] };

export type Mood = "dusk" | "evening" | "tense" | "night" | "lonely";

export type Cast = "prohlad" | "wife" | "prabhash" | "pankaj" | "prokash" | "bou1" | "bou2";

export type Scene = {
  id: number;
  name: string;           // সিনের নাম
  firstWord: number;      // WORDS-এর প্রথম সূচক
  lastWord: number;       // WORDS-এর শেষ সূচক (অন্তর্ভুক্ত)
  mood: Mood;             // আলো/আবহ (ধাপ ৩-এ রঙ বসবে)
  camera: CameraMove;     // ক্যামেরা চাল (ধাপ ৪-এ বাস্তবায়ন)
  cast: Cast[];           // চরিত্র (ধাপ ৫)
  props: string[];        // দৃশ্যের উপাদান (ধাপ ৪)
  card?: string;          // পর্দায় ভেসে ওঠা স্থান/সাল লেখা
  captionPalette: number; // ক্যাপশন রঙের সেট নম্বর (ধাপ ৬)
};

export const SCENES: Scene[] = [
  { id: 1, name: "সাল ১৯৭৬ — শিরোনাম", firstWord: 0, lastWord: 4, mood: "dusk",
    camera: { type: "crane", from: [0, 2, 14], to: [0, 9, 26], look: [0, 3, -10] },
    cast: [], props: ["moon", "clouds", "stars", "tree", "owl"], card: "১৯৭৬", captionPalette: 0 },
  { id: 2, name: "লাহুরিয়া গ্রাম — স্থান পরিচিতি", firstWord: 5, lastWord: 13, mood: "dusk",
    camera: { type: "push", from: [-14, 18, 30], to: [-3, 7, 12], look: [0, 1, -8] },
    cast: [], props: ["village", "paddy", "pond", "trees", "path", "birds"], card: "লাহুরিয়া • লোহাগাড়া • নড়াইল", captionPalette: 1 },
  { id: 3, name: "প্রহ্লাদ বিশ্বাসের পরিবার", firstWord: 14, lastWord: 26, mood: "evening",
    camera: { type: "pan", from: [-6, 2.2, 9], to: [6, 2.2, 9], look: [0, 1.6, 0] },
    cast: ["prohlad", "wife", "prabhash", "pankaj", "prokash"], props: ["courtyard", "hut", "lantern", "tulsi"], captionPalette: 2 },
  { id: 4, name: "প্রভাস ও পঙ্কজের বয়স", firstWord: 27, lastWord: 33, mood: "evening",
    camera: { type: "push", from: [0, 1.8, 8], to: [0, 1.7, 4.5], look: [0, 1.6, 0] },
    cast: ["prabhash", "pankaj"], props: ["courtyard", "hut", "lantern"], captionPalette: 3 },
  { id: 5, name: "বড় ও মেজো ছেলের বিয়ে", firstWord: 34, lastWord: 41, mood: "evening",
    camera: { type: "orbit", center: [0, 1.5, 0], radius: 7, height: 2.4, fromDeg: -35, toDeg: 25 },
    cast: ["prabhash", "pankaj", "bou1", "bou2", "prohlad", "wife"], props: ["wedding-garland", "courtyard", "lantern", "marigold"], captionPalette: 4 },
  { id: 6, name: "একান্নবর্তী পরিবার", firstWord: 42, lastWord: 45, mood: "evening",
    camera: { type: "crane", from: [0, 3, 12], to: [0, 7, 15], look: [0, 1.5, 0] },
    cast: ["prohlad", "wife", "prabhash", "pankaj", "prokash", "bou1", "bou2"], props: ["big-house", "courtyard", "lantern", "smoke"], captionPalette: 1 },
  { id: 7, name: "অমিল ও বিচ্ছেদ — প্রকাশকে নিয়ে বেরিয়ে আসা", firstWord: 46, lastWord: 64, mood: "tense",
    camera: { type: "pan", from: [4, 1.8, 7], to: [-4, 1.8, 7], look: [0, 1.6, 0] },
    cast: ["prohlad", "wife", "prokash", "bou1", "bou2"], props: ["big-house", "doorway", "lantern", "shadow", "cloth-bundle"], captionPalette: 5 },
  { id: 8, name: "পতিত জমিতে তিনটি ঘর", firstWord: 65, lastWord: 80, mood: "tense",
    camera: { type: "push", from: [-18, 5, 24], to: [-4, 3, 10], look: [0, 1.5, -2] },
    cast: ["prohlad", "wife", "prokash"], props: ["empty-land", "three-huts", "bamboo", "thatch", "path"], captionPalette: 6 },
  { id: 9, name: "চারদিকে ফসলি জমি", firstWord: 81, lastWord: 86, mood: "night",
    camera: { type: "orbit", center: [0, 1.5, 0], radius: 22, height: 9, fromDeg: -70, toDeg: 20 },
    cast: [], props: ["paddy", "three-huts", "moon", "fog"], captionPalette: 7 },
  { id: 10, name: "এটা গ্রাম নয় — ফসলি জমির পাশে গ্রাম", firstWord: 87, lastWord: 96, mood: "night",
    camera: { type: "pan", from: [-22, 7, 20], to: [22, 7, 20], look: [0, 1, -6] },
    cast: [], props: ["paddy", "village-far", "three-huts", "moon", "fog"], captionPalette: 0 },
  { id: 11, name: "হেঁটে ১০–১৫ মিনিটের দূরত্ব", firstWord: 97, lastWord: 116, mood: "night",
    camera: { type: "crane", from: [0, 3, 18], to: [0, 14, 34], look: [0, 0, -14] },
    cast: ["prohlad"], props: ["dirt-path", "paddy", "other-houses-far", "three-huts", "moon", "fog", "fireflies"], card: "১০–১৫ মিনিট", captionPalette: 3 },
  { id: 12, name: "ফসলি জমির মাঝখানে একলা ভিটা", firstWord: 117, lastWord: 126, mood: "lonely",
    camera: { type: "push", from: [0, 24, 34], to: [0, 6, 14], look: [0, 1, 0] },
    cast: [], props: ["homestead-mound", "paddy", "moon", "fog", "lantern-glow"], captionPalette: 6 },
  { id: 13, name: "একটি মাত্র পরিবার — সমাপ্তি", firstWord: 127, lastWord: 141, mood: "lonely",
    camera: { type: "push", from: [0, 3, 12], to: [0, 2, 5.5], look: [0, 1.6, 0] },
    cast: ["prohlad", "wife", "prokash"], props: ["homestead-mound", "hut", "lantern", "paddy", "moon", "fog"], captionPalette: 2 },
];

// সিনের সময় (ms): প্রতিটি সিন আগের সিনের শেষ থেকে অবিচ্ছিন্ন; শেষ সিন অডিওর শেষ পর্যন্ত
export const sceneRange = (s: Scene) => {
  const startMs = s.id === 1 ? 0 : WORDS[s.firstWord].startMs;
  const next = SCENES[s.id]; // পরের সিন
  const endMs = next ? WORDS[next.firstWord].startMs : AUDIO_MS;
  return { startMs, endMs, startFrame: msToFrame(startMs), endFrame: msToFrame(endMs) };
};

// বাক্যের শেষ শব্দ (।) — ক্যাপশন গ্রুপিং-এ ব্যবহার হবে (ধাপ ৬)
export const isSentenceEnd = (i: number) => WORDS[i].text.endsWith("।");
