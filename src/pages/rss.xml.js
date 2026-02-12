import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE } from "../consts";

export async function GET() {
  const posts = (await getCollection("posts")).filter(p => !p.data.draft);
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: SITE.url,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      link: `/blog/${p.slug}/`,
      pubDate: p.data.pubDate,
    })),
  });
}
