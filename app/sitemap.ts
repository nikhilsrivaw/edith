import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://edith.expert";
  const now = new Date();

  // Marketing + public docs. Dashboard routes are excluded by robots.txt
  // so we don't list them here either — keeps the sitemap focused on what
  // crawlers should actually index.
  const routes: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1.0 },
    { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
    { path: "/docs", changeFrequency: "weekly", priority: 0.8 },
    { path: "/changelog", changeFrequency: "weekly", priority: 0.6 },
    { path: "/extension", changeFrequency: "monthly", priority: 0.6 },
    { path: "/cli", changeFrequency: "monthly", priority: 0.5 },
    { path: "/integrations", changeFrequency: "monthly", priority: 0.5 },
    { path: "/integrations/mcp", changeFrequency: "monthly", priority: 0.5 },
    { path: "/coverage", changeFrequency: "monthly", priority: 0.4 },
    { path: "/compliance", changeFrequency: "monthly", priority: 0.4 },
  ];

  return routes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
