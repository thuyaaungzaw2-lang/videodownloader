const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const https = require("https"); // ⭐ GitHub mp4 ကို proxy လုပ်ဖို့

const app = express();
const PORT = process.env.PORT || 3000;

// Railway env နဲ့ origin control
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
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
      "Backend is running. This server proxies your own video file with download headers.",
  });
});

// 🔥 MAIN API – frontend က ဒီကိုခေါ်မယ်
app.post("/api/request", async (req, res) => {
  const { videoUrl, resolution = "auto", platform } = req.body || {};

  if (!videoUrl || !looksLikeUrl(videoUrl)) {
    return res.status(400).json({
      status: "error",
      message: "Invalid or missing video URL.",
    });
  }

  const detectedPlatform = detectPlatformFromUrl(videoUrl);
  const clientPlatform = (platform || "").toLowerCase();

  if (detectedPlatform === "unknown") {
    console.warn("Unknown platform for URL:", videoUrl);
  }

  if (
    clientPlatform &&
    detectedPlatform !== "unknown" &&
    clientPlatform !== detectedPlatform
  ) {
    console.warn("Platform mismatch:", {
      fromClient: clientPlatform,
      inferred: detectedPlatform,
      url: videoUrl,
    });
  }

  console.log("Incoming request:", {
    videoUrl,
    resolution,
    detectedPlatform,
  });

  // ✅ ကိုယ်ပိုင် GitHub mp4 URL
  const sourceUrl =
    "https://thuyaaungzaw2-lang.github.io/videodownload/videos/myvideo.mp4";

  // ဒီ proxy endpoint က ဖိုင်ကို attachment header နဲ့ပဲပို့မယ်
  const downloadUrl =
    "https://videodownload-production.up.railway.app/direct-download?source=" +
    encodeURIComponent(sourceUrl);

  return res.json({
    status: "ready",
    message: "Your file is ready for download.",
    downloadUrl,
    info: {
      videoUrl,
      requestedResolution: resolution,
      platform:
        detectedPlatform === "unknown"
          ? clientPlatform || "unknown"
          : detectedPlatform,
    },
  });
});

// 🔥 NEW: GitHub mp4 ကို proxy လုပ်ပြီး attachment အနေနဲ့ပို့မယ့် route
app.get("/direct-download", (req, res) => {
  const source = req.query.source;

  if (!source) {
    return res.status(400).send("Missing source parameter.");
  }

  // simple security check – မင်းရဲ့ GitHub path ထဲက file တွေလောက်ပဲ allow
  const allowedPrefix =
    "https://thuyaaungzaw2-lang.github.io/videodownload/videos/";
  if (!source.startsWith(allowedPrefix)) {
    return res.status(400).send("Invalid source URL.");
  }

  console.log("Proxying download from:", source);

  // Download header တွေသတ်
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="myvideo.mp4"'
  );
  res.setHeader("Content-Type", "video/mp4");

  // GitHub mp4 ကို fetch + pipe
  https
    .get(source, (upstream) => {
      if (upstream.statusCode !== 200) {
        console.error("Upstream status code:", upstream.statusCode);
        res.status(upstream.statusCode || 500);
      }
      upstream.pipe(res);
    })
    .on("error", (err) => {
      console.error("Error fetching source:", err);
      res.status(500).send("Error fetching source video.");
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
