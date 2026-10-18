import { getAllPostsMeta } from "@/lib/posts";
import { CHANNELS, selectChannel, type Channel } from "@/lib/catalog";
import { listAds } from "@/server/repo";
import { PostList } from "./PostList";
export function ChannelPage({
  channel,
  videoFilter = "all",
}: {
  channel: Channel;
  videoFilter?: "all" | "free" | "member";
}) {
  const posts = getAllPostsMeta();
  const meta = CHANNELS[channel];
  const access = channel === "member-videos" ? "member" : videoFilter;
  const selected = selectChannel(posts, channel);
  const isVideo = channel === "videos" || channel === "member-videos";
  const visible = isVideo
    ? selected.filter(
        (p) => access === "all" || (access === "member" ? p.isVip : !p.isVip),
      )
    : selected;
  return (
    <PostList
      posts={visible}
      allPosts={posts}
      ads={listAds(true).filter((a) => a.position === "侧边栏")}
      tabs={
        isVideo ? (
          <nav className="video-filters" aria-label="视频筛选">
            {[
              { value: "all", label: "全部视频", href: "/videos" },
              { value: "free", label: "免费视频", href: "/videos?type=free" },
              {
                value: "member",
                label: "会员视频",
                href: "/videos?type=member",
              },
            ].map((tab) => (
              <a
                key={tab.value}
                href={tab.href}
                aria-current={access === tab.value ? "page" : undefined}
              >
                {tab.label}
              </a>
            ))}
          </nav>
        ) : undefined
      }
      title={meta.title}
      description={meta.description}
    />
  );
}
