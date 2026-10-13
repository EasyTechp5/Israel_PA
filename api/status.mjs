import { SEATS } from "../app/lib/seats.mjs";
import { env } from "../app/lib/env.mjs";
import { MODELS } from "../app/lib/council.mjs";
import fs from "node:fs";
import path from "node:path";
import { BRAINS_DIR } from "../app/lib/env.mjs";

// Tells the page whether the API key is set, without ever revealing it.
export default function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify({
    hasKey: Boolean(env("ANTHROPIC_API_KEY")),
    brainsLoaded: SEATS.filter((s) => fs.existsSync(path.join(BRAINS_DIR, s.slug, "_hot.md"))).length,
    models: MODELS,
    seats: SEATS.map(({ key, name, short, pillar, question, color }) => ({ key, name, short, pillar, question, color })),
  }));
}
