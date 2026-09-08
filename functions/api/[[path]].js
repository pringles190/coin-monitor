/**
 * Cloudflare Pages Function — 업비트 API 중계
 *
 * /api/v1/...  →  https://api.upbit.com/v1/...
 *
 * 같은 도메인에서 호출하므로 CORS 문제가 없다. (헤더는 안전상 붙여둠)
 * functions/ 폴더는 Cloudflare Pages가 자동으로 인식한다 — 별도 설정 불필요.
 */

const UPBIT = "https://api.upbit.com";

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors() });
  }
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: cors() });
  }

  const path = Array.isArray(params.path) ? params.path.join("/") : (params.path || "");
  const target = `${UPBIT}/${path}${url.search}`;

  let upstream;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "upstream_failed", detail: String(err) }), {
      status: 502,
      headers: { ...cors(), "Content-Type": "application/json" },
    });
  }

  const body = await upstream.arrayBuffer();
  const headers = cors();
  headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
  for (const k of ["Remaining-Req", "Retry-After"]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(body, { status: upstream.status, headers });
}

function cors() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "*");
  h.set("Cache-Control", "no-store");
  return h;
}
