"use client";
import { useState } from "react";
export function VideoPlayer({ src, poster }: { src: string; poster?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="video-player">
      <video
        controls
        playsInline
        preload="none"
        poster={poster}
        onError={() => setFailed(true)}
        src={src}
      />
      {failed && <p role="status">当前视频无法播放，请尝试打开原视频。</p>}
      <a href={src} target="_blank" rel="noopener noreferrer">
        打开原视频 ↗
      </a>
    </div>
  );
}
