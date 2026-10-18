"use client";
import { useState } from "react";
import { Icon } from "./Icon";
import type { AdItem } from "./BlogSidebar";
export function SidebarAd({ ad }: { ad: AdItem }) {
  const [failed, setFailed] = useState(false);
  return (
    <a href={ad.link} className="side-ad-link">
      {ad.image && !failed && (
        <img
          src={ad.image}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <span>
        {ad.title}
        <Icon name="arrow" size={14} />
      </span>
    </a>
  );
}
