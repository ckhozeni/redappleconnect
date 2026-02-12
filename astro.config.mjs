import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://warm-moonbeam-7b7ca3.netlify.app",
  integrations: [sitemap()],
});

