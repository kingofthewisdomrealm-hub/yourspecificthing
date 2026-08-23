import { neon } from "@neondatabase/serverless";

function allowed(key) {
  const secret = process.env.RESULTS_KEY;
  if (secret && secret.length > 0) return key === secret;
  return false;
}

async function lines(sql, kind) {
  return sql`
    select body as text, count(*)::int as n, max(created_at)::text as last
    from yst_events
    where kind = ${kind} and body <> ''
    group by body
    order by max(created_at) desc
    limit 200
  `;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  const key = String(req.query.k || req.query.key || "");
  if (!allowed(key)) return res.status(401).json({ ok: false });
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ ok: false });
  try {
    const sql = neon(url);
    const boards = await sql`select count(distinct session_id)::int as n from yst_events where kind = 'here'`;
    const steps = await sql`select count(*)::int as n from yst_events where kind = 'step'`;
    const filled = await sql`select count(*)::int as n from yst_events where kind = 'done'`;
    return res.status(200).json({
      ok: true,
      results: {
        boards: boards[0]?.n ?? 0,
        steps: steps[0]?.n ?? 0,
        filled: filled[0]?.n ?? 0,
        there: await lines(sql, "there"),
        here: await lines(sql, "here"),
        step: await lines(sql, "step"),
      },
    });
  } catch (e) {
    return res.status(500).json({ ok: false });
  }
}
