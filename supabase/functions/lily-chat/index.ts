// Lily chat: helps the listener shape their topics and answers market questions.
// Runs as a Supabase Edge Function so the Gemini key never ships inside the app.
//
// Request:  POST { messages: [{ role: "user" | "assistant", content: string }] }
// Response: { reply: string, suggestions: Suggestion[], sources: {title, url}[] }
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import topicsFile from "./topics.json" with { type: "json" };

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Msg = { role: "user" | "assistant"; content: string };
const topicList = topicsFile.topics.map((t) => `${t.id} = ${t.name}`).join("; ");

const SYSTEM = `You are Lily, the friendly assistant inside easymarket, a personalised markets podcast app for Gen Z listeners.
You do two jobs:
1) Help the listener shape what their podcast covers. When they describe interests, propose concrete changes as "suggestions".
   Valid topic ids: ${topicList}.
   Each suggestion may set: enabled (bool), difficulty ("basic" | "intermediate" | "advanced"),
   frequency ("daily" | "weekdays" | "weekly"), weekly_day (0=Mon..6=Sun), custom_notes (short focus notes, e.g. "focus on Japanese yen and BOJ").
   Only suggest; the listener taps to apply. Ask a clarifying question instead of guessing when their intent is unclear.
2) Answer questions about markets, finance and economics, including definitions (e.g. "what are TIPS?").
   - General concepts: answer from general knowledge, clearly and briefly, matched to the listener's level.
   - Current numbers or recent events: use ONLY the LATEST DATA block below. If the answer is not there, say you don't have that data rather than guessing. Never invent figures.
   - Never give personal financial advice or tell them to buy/sell. When a question touches investing decisions, add one short line: "Not financial advice."
Tone: warm, clear, concise (under 150 words unless asked for more). No markdown headings.

Return ONLY JSON: {"reply": string, "suggestions": [{"topic_id": string, "enabled"?: boolean, "difficulty"?: string, "frequency"?: string, "weekly_day"?: number, "custom_notes"?: string, "reason": string}], "used_data": [series keys from LATEST DATA you relied on]}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "not signed in" }, 401);

    const { messages } = (await req.json()) as { messages: Msg[] };
    const recent = (messages ?? []).slice(-12);

    const [{ data: prefs }, { data: snap }] = await Promise.all([
      supabase.from("topic_prefs").select("topic_id, enabled, difficulty, frequency, weekly_day, custom_notes"),
      supabase.from("market_snapshots").select("as_of, data").order("as_of", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const latest = snap?.data ?? { series: {} };
    const dataBlock = [
      ...Object.entries(latest.series ?? {}).map(([k, v]: [string, any]) => `${k} — ${v.title}: ${v.summary}`),
      latest.ecb_fx ? `ecb_fx — ${latest.ecb_fx.title}: ${latest.ecb_fx.summary}` : "",
    ].filter(Boolean).join("\n");

    const context = `LISTENER'S CURRENT TOPICS: ${JSON.stringify(prefs ?? [])}\n\nLATEST DATA (as of ${snap?.as_of ?? "unavailable"}; daily closes from FRED/ECB):\n${dataBlock || "none available"}`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${SYSTEM}\n\n${context}` }] },
          contents: recent.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
        }),
      },
    );
    if (!r.ok) return json({ error: `Gemini error ${r.status}`, detail: await r.text() }, 502);
    const out = await r.json();
    const text = out?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}";
    const parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim());

    const validIds = new Set(topicsFile.topics.map((t) => t.id));
    const suggestions = (parsed.suggestions ?? []).filter((s: any) => validIds.has(s.topic_id));
    const sources = (parsed.used_data ?? [])
      .map((k: string) => (k === "ecb_fx" ? latest.ecb_fx : latest.series?.[k]))
      .filter(Boolean)
      .map((v: any) => ({ title: v.title, url: v.url }));
    return json({ reply: String(parsed.reply ?? ""), suggestions, sources });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });
}
