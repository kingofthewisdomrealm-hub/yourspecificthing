const SB = process.env.SUPABASE_URL || "https://rmrbvgmgitmqvcwgdnvl.supabase.co";

function allowed(k) {
  const secret = process.env.RESULTS_KEY;
  if (secret && secret.length > 0) return k === secret;
  return false;
}

function key() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function headers() {
  const k = key();
  return {
    apikey: k,
    Authorization: "Bearer " + k,
    "Content-Type": "application/json",
  };
}

async function rows(kind) {
  const url = SB + "/rest/v1/yst_events?kind=eq." + kind + "&select=session_id,body,created_at&order=created_at.desc&limit=4000";
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error("sb");
  return r.json();
}

function lines(list) {
  const map = new Map();
  for (const row of list) {
    const text = String(row.body || "").trim();
    if (!text) continue;
    const prev = map.get(text);
    if (prev) {
      prev.n += 1;
      if (row.created_at > prev.last) prev.last = row.created_at;
    } else {
      map.set(text, { text: text, n: 1, last: row.created_at });
    }
  }
  return Array.from(map.values()).sort(function (a, b) {
    return a.last < b.last ? 1 : -1;
  }).slice(0, 200);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const k = String(req.query.k || req.query.key || "");
  if (!allowed(k)) return res.status(401).json({ ok: false });
  if (!key()) return res.status(503).json({ ok: false });
  try {
    const there = await rows("there");
    const here = await rows("here");
    const step = await rows("step");
    const done = await rows("done");
    const boards = new Set(here.map(function (r) { return r.session_id; })).size;
    return res.status(200).json({
      ok: true,
      results: {
        boards: boards,
        steps: step.length,
        filled: done.length,
        there: lines(there),
        here: lines(here),
        step: lines(step),
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
