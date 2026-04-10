import { useEffect } from "react";
import * as THREE from "three";
import Hls from "hls.js";

export function useMuxStream(splineApp: any, videoUrl: string | null) {
  useEffect(() => {
    if (!splineApp || !videoUrl) {
      console.warn("useMuxStream: Missing splineApp or videoUrl");
      return;
    }

    let hls: Hls | null = null;
    const video = document.createElement("video");
    video.muted = true; // autoplay requires mute
    video.playsInline = true;
    video.autoplay = true;
    video.crossOrigin = "anonymous";
    video.setAttribute("webkit-playsinline", "true");

    // Debug listeners
    video.addEventListener("playing", () => {
      console.log("✅ Video is playing frames, currentTime:", video.currentTime);
    });
    video.addEventListener("pause", () => {
      console.log("⏸️ Video paused");
    });
    video.addEventListener("error", (e) => {
      console.error("❌ Video element error:", e);
    });

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(videoUrl);
      hls.attachMedia(video);
      console.log("🎥 Hls.js attached to video element with URL:", videoUrl);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = videoUrl; // Safari native
      console.log("🎥 Using Safari native HLS with URL:", videoUrl);
    } else {
      console.error("❌ HLS not supported in this environment");
    }

    video.play().catch((err) => {
      console.error("❌ Autoplay blocked or failed:", err);
    });

    const texture = new THREE.VideoTexture(video);
    console.log("🖼️ Created VideoTexture:", texture);

    // 🔑 Target HighlightVideo by ID
    const mesh = splineApp.findObjectById("daad7984-f7e2-473c-8ddb-45422f54cc83");
    if (mesh && mesh.material) {
      console.log("🔎 Found mesh by ID:", mesh.name || "(no name)", mesh);
      mesh.material.map = texture;
      mesh.material.needsUpdate = true;
      console.log("✅ Assigned VideoTexture to mesh.material.map");
    } else {
      console.error("❌ HighlightVideo mesh not found or has no material");
    }

    // Log current video time every 2 seconds
    const timer = setInterval(() => {
      console.log("⏱️ Video currentTime:", video.currentTime);
    }, 2000);

    return () => {
      if (hls) hls.destroy();
      video.pause();
      clearInterval(timer);
    };
  }, [splineApp, videoUrl]);
}
