// declarations.d.ts — অডিও ফাইল import করার টাইপ (Remotion-এর bundler mp3 ফাইলকে URL স্ট্রিং বানিয়ে দেয়)
declare module "*.mp3" {
  const src: string;
  export default src;
}
