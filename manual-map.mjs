import fs from "fs";
import path from "path";

const dir = "./src/content/posts";

const rules = [
  { match: ["ai", "chatgpt", "claude", "model", "tools"], category: "AI", tags: ["ai","tools"] },
  { match: ["hosting", "server", "domain", "dns", "cpanel"], category: "Hosting", tags: ["hosting"] },
  { match: ["wordpress", "elementor", "plugin", "theme", "security"], category: "Web Design", tags: ["wordpress","elementor","security"] },
  { match: ["web-design", "web design", "ui", "ux", "landing"], category: "Web Design", tags: ["web-design"] },
  { match: ["graphic", "design"], category: "Graphic Design", tags: ["graphic-design"] },
  { match: ["tech", "trends", "fintech"], category: "Tech Trends", tags: ["tech-trends"] },
];

function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}

function getField(fm, key) {
  const r = new RegExp(`^${key}:\\s*(.*)$`, "m");
  const m = fm.match(r);
  return m ? m[1].trim() : "";
}

function setFrontmatter({ fm, body }, updates) {
  // keep existing title/description/pubDate
  const title = getField(fm, "title") || `"Untitled"`;
  const description = getField(fm, "description") || title;
  const pubDate = getField(fm, "pubDate") || new Date().toISOString();

  const category = updates.category;
  const tags = updates.tags.length ? updates.tags : ["imported"];

  const out =
`---
title: ${title}
description: ${description}
pubDate: ${pubDate}
category: "${category}"
tags:
${tags.map(t => `  - "${t}"`).join("\n")}
draft: false
---

${body.trim()}\n`;

  return out;
}

function chooseCategoryAndTags(fileName, titleText) {
  const hay = (fileName + " " + titleText).toLowerCase();
  for (const r of rules) {
    if (r.match.some(k => hay.includes(k))) {
      return { category: r.category, tags: r.tags };
    }
  }
  return { category: "Tech Trends", tags: ["tech-trends"] };
}

const files = fs.readdirSync(dir).filter(f => f.endsWith(".md"));

let changed = 0;
for (const f of files) {
  // skip your test files if you want
  if (f === "test-post.md" || f === "this-is-a-new-test-post.md") continue;

  const p = path.join(dir, f);
  const raw = fs.readFileSync(p, "utf8");
  const parsed = parseFrontmatter(raw);
  if (!parsed) continue;

  const title = getField(parsed.fm, "title").replace(/^"|"$/g, "");
  const pick = chooseCategoryAndTags(f, title);

  const updated = setFrontmatter(parsed, pick);
  fs.writeFileSync(p, updated, "utf8");
  changed++;
}

console.log(`✅ Updated ${changed} posts`);
