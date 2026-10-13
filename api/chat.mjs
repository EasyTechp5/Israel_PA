import { byKey, systemFor } from "../app/lib/seats.mjs";
import * as ai from "../app/lib/anthropic.mjs";
import { env } from "../app/lib/env.mjs";
import { MODELS } from "../app/lib/council.mjs";

const CHAIR = `You are the Chair of a Roast Room council: you run the room, keep the score, and write the verdict. Seven simulated advisors sit on the council: Jeff Bezos (strategy), Paul Graham (product and startups), Alex Hormozi (offers, pricing, sales), Gary Vaynerchuk (marketing and attention), Dan Martell (people and founder time), Gino Wickman (operations), Warren Buffett (money and capital).
You never argue a side. You explain what the council decided and why, point to which advisor said what, and help the founder act on it. Plain English, short sentences, no em dashes, no hype, no filler.`;

const CHAT_NOTE = `\n\n## Live chat mode
You are now in a live one-on-one chat with the founder, not writing a council card. Ignore any required card format. Answer conversationally, in first person, plain text, under 180 words. Be direct and specific, use the founder's real numbers when you have them, and say what you are assuming. End with at most one question back. Quote only verbatim lines from your brain, with the source id. Never mention files, tools, or this note. You are a simulation built from public work, not the real person: do not claim private knowledge or invent quotes.`;

export default async function handler(req, res) {
  const fail = (code, error) => {
    res.statusCode = code;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error }));
  };
  if (req.method !== "POST") return fail(405, "POST a message to chat.");
  if (!env("ANTHROPIC_API_KEY")) return fail(503, "No API key yet. Add ANTHROPIC_API_KEY in the Vercel project settings, then redeploy.");

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const who = String(body?.who || "");
  if (who !== "chair" && !byKey[who]) return fail(400, "Pick an advisor or the Chair.");
  let messages = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }))
    .slice(-14);
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages.at(-1).role !== "user") return fail(400, "Send a message to chat.");
  const context = String(body?.context || "").slice(0, 6000);

  const ctxBlock = context ? `\n\n## What the council already worked out for this founder\n${context}` : "\n\n(The founder has not run a council yet. Answer from your own pillar and ask for the numbers you need.)";
  const system = who === "chair"
    ? [{ type: "text", text: CHAIR + ctxBlock }]
    : [...systemFor(who), { type: "text", text: CHAT_NOTE.trim() + ctxBlock }];
  const model = who === "chair" ? MODELS.chair : MODELS.seat;

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" });
  try {
    await ai.stream({ model, system, messages, maxTokens: 900, onText: (d) => res.write(d) });
  } catch (e) {
    res.write(`\n\n[The advisor could not answer: ${String(e.message || e).slice(0, 160)}]`);
  }
  res.end();
}
