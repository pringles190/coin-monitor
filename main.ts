// Deno Deploy 엔트리포인트 — 정적 파일 서빙 + /api 업비트 중계
//
// 배포 (코드 붙여넣기 없음, 폰에서도 가능):
//   1. https://dash.deno.com → New Project
//   2. "Deploy from GitHub" → 저장소 coin-monitor, 브랜치 main
//   3. Entrypoint: main.ts → Deploy
//   4. 나온 주소 https://<이름>.deno.dev 로 접속 (설정 불필요, /api 내장)
//
// 이후 git push 하면 자동 재배포.

import { serveDir } from "jsr:@std/http@1/file-server";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors() });
    const target = "https://api.upbit.com" + url.pathname.slice(4) + url.search;
    const upstream = await fetch(target, { headers: { Accept: "application/json" } });
    const headers = cors();
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  return serveDir(req, { fsRoot: ".", quiet: true });
});

function cors(): Headers {
  const h = new Headers();
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  h.set("Cache-Control", "no-store");
  return h;
}
