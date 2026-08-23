import { neon } from "@neondatabase/serverless";

const KINDS = new Set(["there", "here", "step", "done"]);

async function ensure(sql) {
  await sql`create table if not exists yst_events (
    id serial primary key,
    created_at timestamptz not null default now(),
    session_id text not null,
    kind text not null,
    body text not null default ''
  )`;
  await sql`create index if not exists yst_events_kind_idx on yst_events (kind)`;
  await sql`create index if not exists yst_events_session_idx on yst_events (session_id)`;
  await sql`create index if not exists yst_events_created_idx on yst_events (created_at desc)`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ ok: false });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const sessionId = String(body.sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const kind = String(body.kind || "");
    const text = String(body.text || "").trim().replace(/\s+/g, " ").slice(0, 280);
    if (sessionId.length < 8 || !KINDS.has(kind)) return res.status(400).json({ ok: false });
    if (kind !== "done" && text.length < 3) return res.status(400).json({ ok: false });
    const sql = neon(url);
    await ensure(sql);
    await sql`insert into yst_events (session_id, kind, body) values (${sessionId}, ${kind}, ${kind === "done" ? "" : text})`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
