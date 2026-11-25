import { getCollection } from "astro:content";

export const prerender = true;

export async function GET(context) {
  const posts = (await getCollection("writing")).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  const items = posts.map((post) => {
    const url = new URL(`/writing/${post.id}/`, context.site);
    return `<item><title>${escapeXml(post.data.title)}</title><link>${escapeXml(url.href)}</link><guid>${escapeXml(url.href)}</guid><description>${escapeXml(post.data.description)}</description><pubDate>${post.data.date.toUTCString()}</pubDate></item>`;
  }).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Writing</title><link>${escapeXml(context.site.href)}</link><description>Notes and writing</description>${items}</channel></rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" }
  });
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[character]);
}
