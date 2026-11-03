import { Config } from "@remotion/cli/config";

// ভিডিও সেটিংস
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(18);
Config.setOverwriteOutput(true);

// 3D (three.js) CPU রানারে (GitHub Actions) চালানোর জন্য
Config.setChromiumOpenGlRenderer("angle");

// ধীর 3D দৃশ্যের জন্য বেশি সময় দেওয়া
Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setConcurrency(2);
