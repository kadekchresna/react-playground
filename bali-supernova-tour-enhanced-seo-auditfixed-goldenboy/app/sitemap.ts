import tours from "./(data)/tours.json";
import { SITE_URL } from "./(lib)/site";

export default function sitemap() {
  const base = SITE_URL.replace(/\/$/, "");

  const pages = ["/", "/tours", "/contact", "/privacy-policy", "/terms"];

  const now = new Date();

  return [
    ...pages.map((p) => ({
      url: base + (p === "/" ? "/" : `${p}/`),
      lastModified: now,
      changeFrequency: p === "/" ? "weekly" : "monthly",
      priority: p === "/" ? 1 : p === "/tours" ? 0.9 : 0.6,
    })),
    ...tours.map((t: any) => ({
      url: `${base}/tours/${t.slug}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    })),
  ];
}
