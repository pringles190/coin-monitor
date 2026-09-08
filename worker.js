// 업비트 API CORS 프록시 (Cloudflare Worker)
//
// 배포: dash.cloudflare.com → Workers & Pages → Create → Workers → "Hello World"
//   1. 편집기 안을 클릭 → Ctrl+A (전체 선택) → Delete (전부 지우기)
//   2. 이 파일 내용을 붙여넣기 → Deploy
//   3. 주소(https://<이름>.<계정>.workers.dev)를 대시보드 [설정]에 입력

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }
    if (!url.pathname.startsWith("/v1/")) {
      return new Response("upbit proxy ok", { headers: CORS });
    }

    const upstream = await fetch("https://api.upbit.com" + url.pathname + url.search, {
      headers: { Accept: "application/json" },
    });

    const headers = new Headers(CORS);
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};
