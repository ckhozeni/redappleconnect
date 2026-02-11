import fs from "fs";
import path from "path";

const posts = JSON.parse(fs.readFileSync("./posts.json", "utf8"));
const categories = JSON.parse(fs.readFileSync("./categories.json", "utf8"));
const tags = JSON.parse(fs.readFileSync("./tags.json", "utf8"));

const postsDir = "./src/content/posts";

const catMap = new Map(categories.map(c => [c.id, c.name]));
const tagMap = new Map(tags.map(t => [t.id, t.name]));

function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function esc(s="") { return String(s).replace(/"/g, '\\"'); }

// Extract body by removing the first frontmatter block, CRLF-safe
function splitFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

let updated = 0;
let notFound = 0;
let noFrontmatter = 0;

for (const p of posts) {
  const slug = p.slug;
  const filePath = path.join(postsDir, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    notFound++;
    continue;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const split = splitFrontmatter(raw);

  if (!split) {
    noFrontmatter++;
    continue;
  }

  const body = split.body.trim();

  const title = esc(p.title?.rendered || slug);
  const descText = stripHtml(p.excerpt?.rendered || p.title?.rendered || slug);
  const description = esc(descText || title);

  const catIds = Array.isArray(p.categories) ? p.categories : [];
  const tagIds = Array.isArray(p.tags) ? p.tags : [];

  const categoryName = catIds.length ? (catMap.get(catIds[0]) || "Imported") : "Imported";
  const tagNames = tagIds.map(id => tagMap.get(id)).filter(Boolean).slice(0, 12);
  if (tagNames.length === 0) tagNames.push("imported");

  const pubDate = p.date || new Date().toISOString();

  const fm =
`---
title: "${title}"
description: "${description}"
pubDate: ${pubDate}
category: "${esc(categoryName)}"
tags:
${tagNames.map(t => `  - "${esc(t)}"`).join("\n")}
draft: false
---

`;

  fs.writeFileSync(filePath, fm + "\n" + body + "\n", "utf8");
  updated++;
}

console.log(`✅ Updated: ${updated} posts`);
console.log(`⚠️ Posts not found: ${notFound}`);
console.log(`⚠️ Files missing valid frontmatter: ${noFrontmatter}`);
