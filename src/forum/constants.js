import {
  absUrlForPathname,
  columnsPathname,
  homePathname,
  postsPathname,
  recentPathname,
} from "../routing/paths.js";

export const FORUM_CATEGORIES = ["全部", "热门", "技术", "生活", "灵感", "闲聊"];
export const FORUM_TOPIC_TAGS = ["#学习打卡", "#效率工具", "#内容创作", "#Nooktalk设计", "#开发日志"];

export const FEATURED_COLUMNS = [
  {
    tag: "技术",
    title: "技术专栏",
    desc: "开发笔记、工具链与工程实践",
    accent: "linear-gradient(145deg, #d8e4ff, #f0f4ff)",
    glyph: "⚙️",
  },
  {
    tag: "生活",
    title: "生活专栏",
    desc: "日常记录、习惯与片刻心情",
    accent: "linear-gradient(145deg, #f8e0c8, #fff5ea)",
    glyph: "🌿",
  },
  {
    tag: "灵感",
    title: "灵感专栏",
    desc: "创意碎片、阅读摘录与脑洞",
    accent: "linear-gradient(145deg, #e8d8f8, #f5f0ff)",
    glyph: "✨",
  },
  {
    tag: "闲聊",
    title: "闲聊专栏",
    desc: "轻松话题、随想与站内交流",
    accent: "linear-gradient(145deg, #c8f0d8, #e8faf0)",
    glyph: "💬",
  },
];

export function buildShareSections() {
  return [
    {
      title: "本站",
      hint: "复制链接分享给朋友",
      items: [
        { name: "隅言首页", desc: "探索与快捷入口", url: absUrlForPathname(homePathname()), navTarget: "home" },
        { name: "帖子广场", desc: "浏览、发帖与讨论", url: absUrlForPathname(postsPathname()), navTarget: "posts" },
        { name: "最新讨论", desc: "按时间倒序", url: absUrlForPathname(recentPathname()), navTarget: "recent" },
        { name: "精品专栏", desc: "分类精选", url: absUrlForPathname(columnsPathname()), navTarget: "columns" },
      ],
    },
    {
      title: "开发与学习",
      items: [
        { name: "GitHub", desc: "开源与代码", url: "https://github.com", external: true },
        { name: "MDN", desc: "Web 文档", url: "https://developer.mozilla.org/zh-CN/", external: true },
      ],
    },
    {
      title: "内容与社区",
      items: [
        { name: "哔哩哔哩", desc: "视频社区", url: "https://www.bilibili.com", external: true },
        { name: "少数派", desc: "数字生活", url: "https://sspai.com", external: true },
      ],
    },
  ];
}
