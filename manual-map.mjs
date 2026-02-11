import fs from "fs";
import path from "path";

const dir = "./src/content/posts";

const CATEGORY_DEFAULT = "Tech Trends";

// Keyword rules (edit anytime)
const rules = [
  { cat: "Hosting", keys: ["hosting", "web hosting", "server", "dns", "domain", "cpanel", "vps", "ssl"], tags: ["hosting"] },

  { cat: "Web Design", keys: ["wordpress", "elementor", "plugin", "theme", "landing", "ui", "ux", "web design", "website"], tags: ["web-design","wordpress","elementor"] },

  { cat: "Graphic Design", keys: ["graphic design", "graphic", "branding", "logo", "typography", "poster"], tags: ["graphic-design"] },

  { cat: "Tech Trends", keys: ["tech trends", "tech", "trends", "fintech", "south africa", "public procurement", "tenders"], tags: ["south-africa","tools"] },

  // AI LAST + only specific triggers (not the word "ai")
  { cat: "AI", keys: ["chatgpt", "claude", "llm", "prompt", "ai tools", "artificial intelligence"], tags: ["ai","tools"] },
];

// Allowed tags list (we only keep these)
const ALLOWED_TAGS = new Set([
  "ai",
  "wordpress",
  "elementor",
  "hosting",
  "web-design",
  "graphic-design",
  "tools",
  "south-africa",
  "freelancing",
  "security",
]);

function normNewlines(raw) {
  return raw.replace(/\r\n/g, "\n");
}

function splitFrontmatter(raw) {
  const text = normNewlines(raw);
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

function getField(fm, key) {
  const r = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = fm.match(r);
  return m ? m[1].trim() : "";
}

function stripQuotes(s) {
  return s.replace(/^"(.*)"$/,"$1").replace(/^'(.*)'$/,"$1");
}

function pickByKeywords(fileName, titleText, bodyText) {
  const hay = (fileName + " " + titleText + " " + bodyText).toLowerCase();

  for (const r of rules) {
    if (r.keys.some(k => hay.includes(k))) {
      return { category: r.cat, tags: r.tags };
    }
  }
  return { category: CATEGORY_DEFAULT, tags: ["tools"] };
}

function unique(list) {
  return [...new Set(list)];
}

function clampTags(tags) {
  // keep only allowed tags
  const clean = unique(tags.map(t => String(t).toLowerCase().trim()))
    .filter(t => ALLOWED_TAGS.has(t));
  return clean.length ? clean : ["tools"];
}

function buildFrontmatter(existingFm, updates) {
  const title = getField(existingFm, "title") || `"Untitled"`;
  const description = getField(existingFm, "description") || title;
  const pubDate = getField(existingFm, "pubDate") || new Date().toISOString();

  const category = updates.category;
  const tags = clampTags(updates.tags);

  return `---\n` +
    `title: ${title}\n` +
    `description: ${description}\n` +
    `pubDate: ${pubDate}\n` +
    `category: "${category}"\n` +
    `tags:\n` +
    tags.map(t => `  - "${t}"`).join("\n") + `\n` +
    `draft: false\n` +
    `---\n`;
}

const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));

let changed = 0;
let skipped = 0;

for (const f of files) {
  // leave your manual test posts alone
  if (f === "test-post.md" || f === "this-is-a-new-test-post.md") { skipped++; continue; }

  const p = path.join(dir, f);
  const raw = fs.readFileSync(p, "utf8");
  const parsed = splitFrontmatter(raw);
  if (!parsed) { skipped++; continue; }

  const title = stripQuotes(getField(parsed.fm, "title") || "");
  const body = parsed.body || "";

  const pick = pickByKeywords(f, title, body);

  // Add extra smart tags based on content
  const extraTags = [];
  const hay = (f + " " + title + " " + body).toLowerCase();

  if (hay.includes("wordpress")) extraTags.push("wordpress");
  if (hay.includes("elementor")) extraTags.push("elementor");
  if (hay.includes("security")) extraTags.push("security");
  if (hay.includes("freelance") || hay.includes("freelancing")) extraTags.push("freelancing");
  if (hay.includes("south africa") || hay.includes("pretoria") || hay.includes("za")) extraTags.push("south-africa");
  if (hay.includes("hosting") || hay.includes("dns") || hay.includes("ssl")) extraTags.push("hosting");
  if (hay.includes("ai") || hay.includes("chatgpt") || hay.includes("claude")) extraTags.push("ai");
  if (hay.includes("web design") || hay.includes("website") || hay.includes("ui") || hay.includes("ux")) extraTags.push("web-design");
  if (hay.includes("graphic") || hay.includes("logo") || hay.includes("branding")) extraTags.push("graphic-design");

  const fm = buildFrontmatter(parsed.fm, {
    category: pick.category,
    tags: unique([...pick.tags, ...extraTags]),
  });

  fs.writeFileSync(p, fm + "\n" + normNewlines(body).trim() + "\n", "utf8");
  changed++;
}

console.log(`✅ Updated ${changed} posts`);
console.log(`ℹ️ Skipped ${skipped} files (tests or missing frontmatter)`);
