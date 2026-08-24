const SB = process.env.SUPABASE_URL || "https://rmrbvgmgitmqvcwgdnvl.supabase.co";
const KINDS = new Set(["there", "here", "step", "done"]);

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  if (!key()) return res.status(503).json({ ok: false });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const kind = String(body.kind || "");
    const text = String(body.text || "").trim().replace(/\s+/g, " ").slice(0, 280);
    if (sessionId.length < 8 || !KINDS.has(kind)) return res.status(400).json({ ok: false });
    if (kind !== "done" && text.length < 3) return res.status(400).json({ ok: false });
    const r = await fetch(SB + "/rest/v1/yst_events", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        session_id: sessionId,
        kind: kind,
        body: kind === "done" ? "" : text,
      }),
    });
    if (!r.ok) return res.status(500).json({ ok: false });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
