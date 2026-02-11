import fs from "fs";
import path from "path";
import TurndownService from "turndown";
import slugify from "slugify";

const inputPath = "./posts.json"; // make sure posts.json is in project root
const outputDir = "./src/content/posts";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced"
});

const posts = JSON.parse(fs.readFileSync(inputPath, "utf8"));

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

posts.forEach(post => {
  const title = post.title.rendered.replace(/"/g, '\\"');
  const slug = slugify(post.slug, { lower: true, strict: true });
  const contentHtml = post.content.rendered;
  const contentMd = turndown.turndown(contentHtml);

  const pubDate = post.date;
  const category = "Imported";
  const tags = ["imported"];

  const frontmatter = `---
title: "${title}"
description: "${title}"
pubDate: ${pubDate}
category: "${category}"
tags:
  - "${tags[0]}"
draft: false
---

`;

  fs.writeFileSync(
    path.join(outputDir, `${slug}.md`),
    frontmatter + contentMd
  );

  console.log(`Created: ${slug}.md`);
});

console.log("Migration complete.");
