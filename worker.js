/**
 * Cloudflare Worker — Secure Proxy for Radiology Course
 *
 * Secrets — set via: wrangler secret put SECRET_NAME
 *
 *   ACCESS_CODE        e.g.  RADIOLOGY2024
 *   ADMIN_CODE         e.g.  ADMIN2024
 *   CASES_URL          Power Automate cases flow URL
 *   SETTINGS_URL       Power Automate settings flow URL
 *   ADMIN_FLOW_URL     Power Automate admin flow URL
 *   FLOW_URL           Power Automate scores/leaderboard flow URL
 *   PROGRESS_URL       Power Automate progress flow URL
 *   GROQ_API_KEY       Your Groq API key (free at console.groq.com)
 */

// ─── CORS helper ──────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function json(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(origin),
  });
}

// ─── Forward a request to Power Automate ─────────────────────────────────────

async function callFlow(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Flow error: HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

// ─── Radiology Tutor via Groq ─────────────────────────────────────────────────

const TUTOR_SYSTEM_PROMPT = `You are Dr. Ray, an expert Radiology Tutor inside an interactive radiology course.

Personality:
- Friendly, fun, clinically accurate
- Encouraging like a senior mentor
- Professional but approachable
- Use specific radiology terms, always explained simply
- Occasional emojis 🩻 💡 ✅

CRITICAL RULES:
- Answer ONLY what the student asks — nothing more
- NEVER list all the answer options unless explicitly asked
- NEVER dump all case information — use it silently as background knowledge
- Give SHORT focused answers (2-5 sentences max) unless the student asks for more detail
- Only expand with more detail when the student asks a follow-up
- End with ONE short follow-up question to deepen thinking
- If asked something unrelated to radiology, say: "I'm here for radiology only! 🩻"

You have the case context in your system — use it as background knowledge to give accurate answers, but do NOT recite it back unless specifically asked.`;

async function askTutor(env, { question, caseTitle, caseContent, questionText, options, correctAnswer, userAnswer, explanation, conversationHistory }) {

  const caseContext = (caseTitle || questionText)
    ? `\n\n=== ACTIVE CASE (you MUST reference this) ===
Case: ${caseTitle || "Radiology Case"}
Clinical History: ${caseContent || "Not provided"}
Question: ${questionText || "Not provided"}
Options: ${options || "Not provided"}
Correct Answer: ${correctAnswer || "Not provided"}
Student Answered: ${userAnswer || "Not yet answered"}
Explanation: ${explanation || "Not provided"}
=== END CASE ===`
    : "";

  const systemWithContext = TUTOR_SYSTEM_PROMPT + caseContext;

  const messages = conversationHistory && conversationHistory.length > 0
    ? [...conversationHistory.slice(-6), { role: "user", content: question }]
    : [{ role: "user", content: question }];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemWithContext },
        ...messages
      ],
      max_tokens: 400,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response. Please try again!";
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }

    const { action } = body;

    // ── Auth ────────────────────────────────────────────────────────────────
    if (action === "validateAccessCode") {
      const { code } = body;
      if (!code) return json({ valid: false }, 400, origin);
      const valid = code.trim().toUpperCase() === env.ACCESS_CODE.trim().toUpperCase();
      return json({ valid }, 200, origin);
    }

    if (action === "validateAdminCode") {
      const { code } = body;
      if (!code) return json({ valid: false }, 400, origin);
      const valid = code.trim().toUpperCase() === env.ADMIN_CODE.trim().toUpperCase();
      return json({ valid }, 200, origin);
    }

    // ── AI Tutor ────────────────────────────────────────────────────────────
    if (action === "askTutor") {
      try {
        const reply = await askTutor(env, body);
        return json({ reply }, 200, origin);
      } catch (e) {
        console.error("Tutor error:", e.message);
        return json({ reply: "⚠️ Dr. Ray error: " + e.message }, 200, origin);
      }
    }

    // ── Cases ───────────────────────────────────────────────────────────────
    if (action === "getCases") {
      try {
        const data = await callFlow(env.CASES_URL, { action: "getCases" });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    // ── Settings ────────────────────────────────────────────────────────────
    if (action === "getSettings") {
      try {
        const data = await callFlow(env.SETTINGS_URL, { action: "getSettings" });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    if (action === "saveSettings") {
      const { startDate, endDate, isActive } = body;
      try {
        const data = await callFlow(env.SETTINGS_URL, { action: "saveSettings", startDate, endDate, isActive });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    // ── Leaderboard / scores ─────────────────────────────────────────────────
    if (action === "getLeaderboard") {
      try {
        const data = await callFlow(env.FLOW_URL, { action: "getLeaderboard" });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    if (action === "saveScore") {
      const { name, email, score } = body;
      try {
        const data = await callFlow(env.FLOW_URL, { action: "saveScore", name, email, score });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    // ── Progress ─────────────────────────────────────────────────────────────
    if (action === "saveProgress") {
      const { email, name, caseIndex, questionIndex, score, answers, timeLeft } = body;
      try {
        const data = await callFlow(env.PROGRESS_URL, {
          action: "saveProgress", email, name, caseIndex, questionIndex, score, answers, timeLeft,
        });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    if (action === "getProgress") {
      const { email } = body;
      try {
        const data = await callFlow(env.PROGRESS_URL, { action: "getProgress", email });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    if (action === "clearProgress") {
      const { email } = body;
      try {
        const data = await callFlow(env.PROGRESS_URL, { action: "clearProgress", email });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    // ── Admin data ────────────────────────────────────────────────────────────
    if (action === "getAdminData") {
      try {
        const data = await callFlow(env.ADMIN_FLOW_URL, { action: "getAdminData" });
        return json(data, 200, origin);
      } catch (e) {
        return json({ error: e.message }, 502, origin);
      }
    }

    return json({ error: `Unknown action: ${action}` }, 400, origin);
  },
};
