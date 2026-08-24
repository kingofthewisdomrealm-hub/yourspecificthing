const SB = process.env.SUPABASE_URL || "https://rmrbvgmgitmqvcwgdnvl.supabase.co";
const WISDOM_TO = "wisdom@yourspecificthing.com";

function key() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function headers(extra) {
  const k = key();
  return Object.assign({
    apikey: k,
    Authorization: "Bearer " + k,
    "Content-Type": "application/json",
  }, extra || {});
}

function cleanName(s) {
  return String(s || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function cleanEmail(s) {
  return String(s || "").trim().toLowerCase().slice(0, 120);
}

function cleanText(s) {
  return String(s || "").trim().replace(/\s+/g, " ").slice(0, 280);
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function planText(name, there, here, steps) {
  const lines = [
    "Hi " + name + ",",
    "",
    "Here is your specific plan — your words, as you wrote them.",
    "",
    "Your specific thing",
    there,
    "",
    "The truth right now",
    here,
    "",
    "Your steps",
  ];
  (steps || []).forEach(function (s, i) {
    lines.push((i + 1) + ". " + s);
  });
  lines.push("");
  lines.push("You filled the road.");
  lines.push("");
  lines.push("— Your Specific Thing");
  lines.push("A Ruler of Wisdom product · rulerofwisdom.com");
  return lines.join("\n");
}

function notifyText(name, email, there, here, steps) {
  const lines = [
    "New plan signup",
    "",
    "Name: " + name,
    "Email: " + email,
    "",
    "Your specific thing",
    there,
    "",
    "The truth right now",
    here,
    "",
    "Steps",
  ];
  (steps || []).forEach(function (s, i) {
    lines.push((i + 1) + ". " + s);
  });
  return lines.join("\n");
}

async function sendResend(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) return false;
  const from = process.env.RESEND_FROM || "Your Specific Thing <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from,
      to: [to],
      subject: subject,
      text: text,
    }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!key()) return res.status(503).json({ ok: false });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const name = cleanName(body.name);
    const email = cleanEmail(body.email);
    const there = cleanText(body.there);
    const here = cleanText(body.here);
    const steps = Array.isArray(body.steps)
      ? body.steps.map(cleanText).filter(function (s) { return s.length >= 3; }).slice(0, 12)
      : [];
    if (sessionId.length < 8 || name.length < 2 || !isEmail(email) || there.length < 3 || here.length < 3) {
      return res.status(400).json({ ok: false });
    }

    // Always save name + email + plan to the database first
    const payload = JSON.stringify({ name: name, email: email, there: there, here: here, steps: steps });
    const r = await fetch(SB + "/rest/v1/yst_events", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        session_id: sessionId,
        kind: "lead",
        body: payload.slice(0, 2000),
      }),
    });
    if (!r.ok) return res.status(500).json({ ok: false });

    let emailed = false;
    let notified = false;
    try {
      emailed = await sendResend(email, "Your specific plan", planText(name, there, here, steps));
    } catch (e) {
      emailed = false;
    }
    try {
      notified = await sendResend(
        WISDOM_TO,
        "New plan: " + name,
        notifyText(name, email, there, here, steps)
      );
    } catch (e) {
      notified = false;
    }

    return res.status(200).json({ ok: true, emailed: emailed, notified: notified });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
