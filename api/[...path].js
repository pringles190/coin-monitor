// Vercel Serverless Function — 업비트 API 중계
// /api/v1/... → https://api.upbit.com/v1/...
// api/ 폴더가 있으면 Vercel이 자동으로 라우팅한다 (설정 불필요).

export default async function handler(req, res) {
  const { path = [], ...rest } = req.query;
  const p = Array.isArray(path) ? path.join("/") : String(path || "");
  const qs = new URLSearchParams(rest).toString();
  const target = "https://api.upbit.com/" + p + (qs ? "?" + qs : "");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const upstream = await fetch(target, { headers: { Accept: "application/json" } });
    const body = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");
    res.status(upstream.status).send(body);
  } catch (e) {
    res.status(502).json({ error: "upstream_failed", detail: String(e) });
  }
}
