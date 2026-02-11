import TurndownService from "turndown";
import { JSDOM } from "jsdom";
import { parseStringPromise } from "xml2js";
import slugify from "slugify";
import he from "he";
import fs from "fs";
import path from "path";

const SITE = "https://redappleconnect.co.za";

// Try common WP endpoints (one of these usually works)
const CANDIDATES = [
  `${SITE}/wp-sitemap.xml`,
  `${SITE}/sitemap.xml`,
  `${SITE}/sitemap_index.xml`,
  `${SITE}/feed/`,
  `${SITE}/?feed=rss2`,
];

const OUT_DIR = path.resolve(process.cwd(), "../../src/content/posts");
fs.mkdirSync(OUT_DIR, { recursive: true });

const headers = {
  // A normal browser-like UA helps avoid security blocks
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
  "accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function fetchText(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return await res.text();
}

function cleanText(s) {
  return he.decode(String(s || "")).replace(/\s+/g, " ").trim();
}

function safeSlug(s) {
  return slugify(s, { lower: true, strict: true, trim: true });
}

async function getUrlsFromSitemap(xml) {
  const data = await parseStringPromise(xml);
  // sitemapindex -> sitemaps -> urls
  if (data.sitemapindex?.sitemap) {
    const sitemaps = data.sitemapindex.sitemap
      .map((x) => x.loc?.[0])
      .filter(Boolean);

    const all = [];
    for (const sm of sitemaps) {
      try {
        const smXml = await fetchText(sm);
        const urls = await getUrlsFromSitemap(smXml);
        all.push(...urls);
      } catch {}
    }
    return all;
  }

  // urlset -> urls
  const urls = (data.urlset?.url || [])
    .map((u) => u.loc?.[0])
    .filter(Boolean);

  // Heuristic: ignore obvious non-post pages
  return urls.filter((u) => u.startsWith(SITE) && !u.includes("/wp-"));
}

async function getUrlsFromFeed(xml) {
  const data = await parseStringPromise(xml);
  const items = data.rss?.channel?.[0]?.item || [];
  return items.map((i) => i.link?.[0]).filter(Boolean);
}

function extractMainContent(document) {
  // common WP theme containers:
  const selectors = [
    "article",
    ".entry-content",
    ".post-content",
    ".content-area article",
    "main article",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return document.body;
}

function extractMeta(document) {
  const title =
    document.querySelector("h1")?.textContent ||
    document.querySelector("title")?.textContent ||
    "Untitled";

  // Try published time from meta tags
  const published =
    document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ||
    document.querySelector("time")?.getAttribute("datetime") ||
    "";

  // Try category from common places (fallback: "Imported")
  const cat =
    document.querySelector(".cat-links a")?.textContent ||
    document.querySelector("a[rel='category tag']")?.textContent ||
    "Imported";

  return {
    title: cleanText(title),
    pubDate: published ? published : new Date().toISOString(),
    category: cleanText(cat) || "Imported",
  };
}

async function migratePost(url) {
  const html = await fetchText(url);
  const dom = new JSDOM(html);
  const { document } = dom.window;

  const meta = extractMeta(document);
  const main = extractMainContent(document);

  // remove junk UI
  main.querySelectorAll("nav, header, footer, .share, .comments, script, style").forEach((n) => n.remove());

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  const mdBody = turndown.turndown(main.innerHTML).trim();

  const slugFromUrl = url.replace(SITE, "").replace(/\/*$/, "").split("/").pop();
  const slug = safeSlug(slugFromUrl || meta.title);

  // IMPORTANT: tags is required by your Astro schema
  const frontmatter = `---\n` +
    `title: "${meta.title.replace(/"/g, '\\"')}"\n` +
    `description: "${meta.title.replace(/"/g, '\\"')}"\n` +
    `pubDate: ${meta.pubDate}\n` +
    `category: "${meta.category.replace(/"/g, '\\"')}"\n` +
    `tags:\n` +
    `  - "imported"\n` +
    `draft: false\n` +
    `---\n\n`;

  const outPath = path.join(OUT_DIR, `${slug}.md`);
  fs.writeFileSync(outPath, frontmatter + mdBody + "\n", "utf8");
  console.log(`✅ Saved: ${slug}.md`);
}

async function main() {
  let sourceUrl = null;
  let sourceXml = null;

  for (const u of CANDIDATES) {
    try {
      const t = await fetchText(u);
      sourceUrl = u;
      sourceXml = t;
      console.log(`✅ Using source: ${u}`);
      break;
    } catch (e) {
      // ignore
    }
  }

  if (!sourceXml) {
    console.log("❌ Could not access sitemap/feed endpoints. Security may be blocking. Tell me and we’ll switch strategy.");
    process.exit(1);
  }

  let urls = [];
  if (sourceUrl.includes("feed")) {
    urls = await getUrlsFromFeed(sourceXml);
  } else {
    urls = await getUrlsFromSitemap(sourceXml);
  }

  // keep likely “post” URLs: wordpress posts are usually root-level with trailing slash
  urls = urls
    .filter((u) => u.startsWith(SITE))
    .filter((u) => !u.endsWith("/wp-json/"))
    .filter((u) => !u.includes("/category/") && !u.includes("/tag/") && !u.includes("/page/"))
    .slice(0, 200);

  console.log(`Found ${urls.length} URLs. Migrating...`);

  for (const u of urls) {
    // skip homepage
    if (u === `${SITE}/`) continue;
    try {
      await migratePost(u);
    } catch (e) {
      console.log(`⚠️ Skipped ${u}: ${e.message}`);
    }
  }

  console.log("✅ Done. Now run: npm run build");
}

main();
