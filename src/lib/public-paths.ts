import { articles } from "./articles";
import { tools } from "./site";

export const publicPaths = [
  "/",
  ...Object.keys(tools).map((slug) => `/${slug}/`),
  ...Object.keys(articles).map((slug) => `/${slug}/`),
  "/privacy/",
  "/guides/",
  "/how-to-download-instagram-followers-data/",
  "/changelog/",
];
