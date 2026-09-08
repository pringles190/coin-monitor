/**
 * 업비트 API CORS 프록시 — Cloudflare Worker
 *
 * 브라우저에서 api.upbit.com 을 직접 호출하면 CORS 로 차단된다.
 * 이 Worker 가 서버 사이드에서 대신 호출하고 CORS 헤더를 붙여 돌려준다.
 *
 * 배포 (CLI 불필요):
 *   1. https://dash.cloudflare.com → Workers & Pages → Create → Worker
 *   2. 이름 정하고 Deploy → Edit code → 이 파일 내용 전체 붙여넣기 → Deploy
 *   3. 나온 주소(https://<이름>.<계정>.workers.dev)를 대시보드 [설정] 에 입력
 *
 * 원한다면 ALLOW_ORIGIN 을 본인 페이지 주소로 좁혀도 된다.
 */

const UPBIT = "https://api.upbit.com";
const ALLOW_ORIGIN = "*"; // 예: "https://pringles190.github.io"

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
    }
    // /v1/* 경로만 업비트로 전달 (그 외에는 헬스 체크)
    if (!url.pathname.startsWith("/v1/")) {
      return new Response("upbit proxy ok", { headers: corsHeaders() });
    }

    const target = UPBIT + url.pathname + url.search;
    let upstream;
    try {
      upstream = await fetch(target, {
        method: "GET",
        headers: { Accept: "application/json" },
        cf: { cacheTtl: 0, cacheEverything: false },
      });
    } catch (err) {
      return json({ error: "upstream_fetch_failed", detail: String(err) }, 502);
    }

    const body = await upstream.arrayBuffer();
    const headers = corsHeaders();
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
    // 업비트 레이트리밋 헤더도 그대로 전달
    for (const k of ["Remaining-Req", "Retry-After"]) {
      const v = upstream.headers.get(k);
      if (v) headers.set(k, v);
    }
    return new Response(body, { status: upstream.status, headers });
  },
};

function corsHeaders() {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Access-Control-Allow-Headers", "*");
  h.set("Access-Control-Max-Age", "86400");
  h.set("Cache-Control", "no-store");
  return h;
}

function json(obj, status) {
  const h = corsHeaders();
  h.set("Content-Type", "application/json");
  return new Response(JSON.stringify(obj), { status: status || 200, headers: h });
}
