const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

// ဒီနေရာမှာ frontend origin ကို env နဲ့ထိန်းချင်ရင် သုံးလို့ရမယ်
// Railway မှာ ALLOWED_ORIGINS ကို set လိုက်ရင် okay
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // mobile app / curl / server-side request တွေအတွက် origin မပါတဲ့အခါ
      if (!origin) {
        return callback(null, true);
      }

      if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS: " + origin));
    },
  })
);

app.use(express.json());
app.use(morgan("tiny"));

function looksLikeUrl(value) {
  try {
    new URL(value);
    return true;
  } catch (e) {
    return false;
  }
}

function detectPlatformFromUrl(value) {
  if (!value) return "unknown";

  let url;
  try {
    url = new URL(value);
  } catch (e) {
    try {
      url = new URL("https://" + value);
    } catch (err) {
      return "unknown";
    }
  }

  const host = url.hostname.toLowerCase();

  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "youtube";
  }
  if (host.includes("facebook.com") || host.includes("fb.watch")) {
    return "facebook";
  }
  if (host.includes("tiktok.com")) {
    return "tiktok";
  }

  return "unknown";
}

// Health / info route
app.get("/", (req, res) => {
  res.json({
    name: "All-in-One Video Helper Backend",
    author: "Thu Ya Aung Zaw",
    message:
      "Backend is running. Implement your own processing / download logic according to each platform's rules.",
  });
});

// Main API
app.post("/api/request", async (req, res) => {
  const { videoUrl, resolution = "auto", platform } = req.body || {};

  if (!videoUrl || !looksLikeUrl(videoUrl)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid or missing video URL.",
    });
  }

  // Frontend က detect လိုက်သလို backend မှာလည်း detect ထပ်လုပ်တယ်
  const detectedPlatform = detectPlatformFromUrl(videoUrl);
  const clientPlatform = (platform || "").toLowerCase();

  // platform အမှန်တကယ် ဒြပ်စုံမိ မစုံမစုံ စစ်ကြည့်
  if (detectedPlatform === "unknown") {
    console.warn("Unknown platform for URL:", videoUrl);
  }

  // client side နဲ့ backend detect မကိုက်ရင် log ထားမယ် (security အနည်းငယ်)
  if (clientPlatform && detectedPlatform !== "unknown" && clientPlatform !== detectedPlatform) {
    console.warn("Platform mismatch:", {
      fromClient: clientPlatform,
      inferred: detectedPlatform,
      url: videoUrl,
    });
  }

  // Download logic / Job queue / Worker သွားစေမယ်ဆိုရင် ဒီနေရာလောက်ကနေစ
  // ❗ IMPORTANT NOTE:
  // ဒီ backend က URL + resolution + platform ကို လက်ခံပေးရုံပါပဲ။
  // YouTube / Facebook / TikTok ကို stream-rip/downloader လုပ်ရာမှာ
  //   - သူတို့ရဲ့ Terms of Service
  //   - Copyright စည်းမျဉ်း
  // တွေကို အပြည့်အဝလိုက်နာရပါမယ်။
  //
  // အကောင်းဆုံးคือ
  //   - ကိုယ်ပိုင် content
  //   - အသုံးပြုခွင့်ရထားတဲ့ content
  //   - အရိပ်အချင်းတင် / clipping လျှောက်လုပ်တဲ့ပုံစံတွေကို
  // စနစ်တကျ API နဲ့ handle လိုက်သင့်ပါတယ်။

  // demo အနေနဲ့ "queued" ဆန်ဆန် response ပြန်ပေးထားမယ်
  console.log("Incoming request:", {
    videoUrl,
    resolution,
    detectedPlatform,
  });

  // နောင်တစ်ချီမှာ
  //   - jobId generate လုပ်ပြီး queue ထဲသို့ ထည့်
  //   - /api/status/:jobId လို့ query ဖို့ design ပြီး
  //   - ready ဖြစ်တဲ့အချိန်မှာ downloadUrl ပြန်ပေး
  // စတဲ့ pattern နဲ့ဆက်တင်သွားလို့ရတယ်။

  return res.json({
    status: "queued",
    message:
      "Request accepted. Implement the actual processing / download logic on the server side for your own allowed use-cases.",
    data: {
      videoUrl,
      resolution,
      platform: detectedPlatform === "unknown" ? clientPlatform || "unknown" : detectedPlatform,
    },
  });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Route not found.",
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

