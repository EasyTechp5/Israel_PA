import { startCouncil, subscribe } from "../app/lib/council.mjs";
import { env } from "../app/lib/env.mjs";

// One request runs one whole council and streams its events (server-sent events).
// Nothing is kept between requests, so this works on serverless functions.
export default async function handler(req, res) {
  const fail = (code, error) => {
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error }));
  };
  if (req.method !== "POST") return fail(405, "POST a decision to run a council.");
  if (!env("ANTHROPIC_API_KEY")) return fail(503, "No API key yet. Add ANTHROPIC_API_KEY in the Vercel project settings, then redeploy.");

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const prompt = String(body?.prompt || "").trim().slice(0, 4000);
  const mode = body?.mode === "full" ? "full" : "quick";
  if (prompt.length < 10) return fail(400, "Give the council a real decision (at least a sentence).");

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  res.write(": connected\n\n");
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  const done = () => { clearInterval(ping); if (!res.writableEnded) res.end(); };
  res.on("close", () => clearInterval(ping));

  const s = startCouncil(prompt, mode);
  subscribe(s, {
    write(chunk) {
      if (!res.writableEnded) res.write(chunk);
      if (typeof chunk === "string" && chunk.includes('"type":"end"')) done();
      return true;
    },
    on(ev, fn) { res.on(ev, fn); },
  });
  // Keep the function alive until the council finishes.
  await new Promise((resolve) => res.on("close", resolve));
}
