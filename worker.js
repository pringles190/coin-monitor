// 코인 모니터 프록시 (Cloudflare Worker)
//
// 배포: dash.cloudflare.com → Workers & Pages → Create → Workers → "Hello World"
//   1. 편집기 안 클릭 → Ctrl+A → Delete (전체 삭제)
//   2. 이 파일 내용 붙여넣기 → Deploy
//   3. 주소(https://<이름>.workers.dev)를 대시보드 [설정]에 입력
//
// 경로:
//   /v1/...  → api.upbit.com 중계 (시세·캔들)
//   /news    → 코인 뉴스 RSS 모음 (JSON)
//
// 뉴스 AI 요약(선택): Cloudflare 대시보드 → 이 Worker → Settings → Variables 에
//   ANTHROPIC_API_KEY = sk-ant-...   (console.anthropic.com 에서 발급)
//   NEWS_MODEL = claude-haiku-4-5    (선택, 기본값)
// 을 추가하면 헤드라인 대신 한국어 2문장 요약이 나온다. 없으면 발췌문만.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/news" || url.pathname.endsWith("/news")) {
      return handleNews(request, env);
    }

    if (!url.pathname.startsWith("/v1/")) {
      return new Response("coin-monitor proxy ok", { headers: CORS });
    }

    const upstream = await fetch("https://api.upbit.com" + url.pathname + url.search, {
      headers: { Accept: "application/json" },
    });
    const headers = new Headers(CORS);
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    return new Response(upstream.body, { status: upstream.status, headers });
  },
};

// ---------- 뉴스 ----------

const FEEDS = [
  // 국내 전문지
  { url: "https://www.blockmedia.co.kr/feed", fallbackSource: "블록미디어", take: 10 },
  { url: "https://www.tokenpost.kr/rss", fallbackSource: "토큰포스트", filter: true, take: 5 },
  // 해외 전문지 (암호화폐 전문 → 키워드 필터 불필요)
  { url: "https://cointelegraph.com/rss", fallbackSource: "Cointelegraph", take: 8 },
  { url: "https://decrypt.co/feed", fallbackSource: "Decrypt", take: 8 },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss", fallbackSource: "CoinDesk", take: 8 },
  { url: "https://www.theblock.co/rss.xml", fallbackSource: "The Block", take: 8 },
  // 구글 뉴스(국내) — GNEWS_OK 언론사 + 키워드 필터
  {
    url: "https://news.google.com/rss/search?q=" +
      encodeURIComponent("(비트코인 OR 이더리움 OR 암호화폐 OR 가상자산 OR 알트코인)") +
      "&hl=ko&gl=KR&ceid=KR:ko",
    gnews: true, filter: true, take: 10,
  },
];

// 암호화폐 관련성 키워드 (국내 종합지·종합 피드 걸러내기용)
const CRYPTO_RE = /비트코인|이더리움|암호화폐|가상자산|가상화폐|스테이블|블록체인|디지털자산|알트코인|밈코인|디파이|\bDeFi\b|바이낸스|업비트|빗썸|코인베이스|리플|\bXRP\b|솔라나|도지|\bBTC\b|\bETH\b|\bNFT\b|웹3|\bWeb3\b|온체인|토큰증권|가상화폐|코인|토큰/i;

// 구글 뉴스에서 채택할 국내 언론사
const GNEWS_OK = [
  "연합뉴스", "연합인포맥스", "이데일리", "한국경제", "한국경제TV", "매일경제", "서울경제",
  "조선비즈", "머니투데이", "파이낸셜뉴스", "뉴스1", "뉴시스", "아시아경제", "헤럴드경제",
  "전자신문", "ZDNet korea", "지디넷코리아", "비즈워치", "블록미디어", "디센터", "토큰포스트",
  "코인데스크코리아", "블루밍비트", "코인니스", "이코노미스트", "더구루",
];

const MAX_AGE_MS = 3 * 24 * 3600 * 1000; // 3일

async function handleNews(request, env) {
  const origin = new URL(request.url).origin;
  const cacheKey = new Request(origin + "/__news_cache_v1");
  const cache = caches.default;

  const hit = await cache.match(cacheKey);
  if (hit) {
    const h = new Headers(hit.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(hit.body, { status: hit.status, headers: h });
  }

  const now = Date.now();
  const collected = [];
  await Promise.all(FEEDS.map(async (feed) => {
    try {
      const r = await fetch(feed.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 coin-monitor/1.0 (+https://github.com/pringles190/coin-monitor)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
        cf: { cacheTtl: 300 },
      });
      if (!r.ok) return;
      const xml = await r.text();
      let rows = parseRss(xml).filter((it) => it.title && it.url && now - it.ts < MAX_AGE_MS);
      if (feed.gnews) {
        rows = rows.filter((it) => GNEWS_OK.includes(it.source));
        for (const it of rows) it.excerpt = ""; // 구글 뉴스 발췌문은 제목 반복이라 버림
      }
      if (feed.filter) {
        rows = rows.filter((it) => CRYPTO_RE.test(it.title + " " + it.excerpt));
      }
      rows.sort((a, b) => b.ts - a.ts);
      for (const it of rows.slice(0, feed.take || 10)) {
        collected.push({ ...it, source: it.source || feed.fallbackSource });
      }
    } catch (e) { /* 개별 피드 실패는 무시 */ }
  }));

  // 제목 정규화로 중복 제거 (발췌문이 더 긴 쪽을 남김)
  const byKey = new Map();
  for (const it of collected) {
    const k = norm(it.title);
    const prev = byKey.get(k);
    if (!prev || it.excerpt.length > prev.excerpt.length) byKey.set(k, it);
  }

  let items = [...byKey.values()]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 24)
    .map((it) => ({
      title: it.title,
      url: it.url,
      source: it.source || "",
      published: new Date(it.ts).toISOString(),
      excerpt: it.excerpt || "",
      summary: "",
      coins: [],
    }));

  if (env && env.ANTHROPIC_API_KEY && items.length) {
    try { items = await summarize(items, env.ANTHROPIC_API_KEY, env.NEWS_MODEL); }
    catch (e) { /* 요약 실패 시 발췌문 그대로 */ }
  }

  const bodyStr = JSON.stringify({ items, updated: new Date().toISOString() });
  const respHeaders = new Headers(CORS);
  respHeaders.set("Content-Type", "application/json");

  const cacheHeaders = new Headers({ "Content-Type": "application/json", "Cache-Control": "max-age=900" });
  await cache.put(cacheKey, new Response(bodyStr, { headers: cacheHeaders }));

  return new Response(bodyStr, { headers: respHeaders });
}

function parseRss(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || xml.match(/<entry[\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    let title = decodeXml(pick(b, "title"));
    let link = pick(b, "link");
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/); if (m) link = m[1]; }
    const pub = pick(b, "pubDate") || pick(b, "published") || pick(b, "updated") || pick(b, "dc:date");
    const desc = pick(b, "description") || pick(b, "summary") || pick(b, "content:encoded") || "";
    const src = decodeXml(pick(b, "source"));
    const ts = pub ? Date.parse(pub) : Date.now();

    // Google News 제목은 "제목 - 언론사" 형태 → source 태그로 꼬리 제거
    if (src && title.endsWith(" - " + src)) title = title.slice(0, -(src.length + 3)).trim();

    out.push({
      title: title,
      url: link,
      excerpt: stripHtml(decodeXml(desc)).slice(0, 400),
      source: src,
      ts: isNaN(ts) ? Date.now() : ts,
    });
  }
  return out;
}

function pick(block, tag) {
  const m = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + tag + ">"));
  if (!m) return "";
  return m[1].replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "").trim();
}
function stripHtml(s) { return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function decodeXml(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&nbsp;?/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&");
}
function norm(t) { return t.toLowerCase().replace(/[^a-z0-9가-힣]/g, "").slice(0, 40); }

async function summarize(items, apiKey, model) {
  const list = items.map((it, i) =>
    `[${i}] (${it.source}) ${it.title}` + (it.excerpt ? `\n${it.excerpt}` : "")
  ).join("\n\n");

  const system =
    "너는 암호화폐 뉴스 편집자다. 각 기사를 한국어 2문장으로 사실 위주로 요약하고 " +
    "관련 코인 티커(BTC, ETH 등)를 뽑는다. 과장 표현과 투자 권유는 절대 쓰지 않는다.";
  const user =
    "다음 기사들을 요약해라. 반드시 JSON 배열만 출력한다. 다른 텍스트 금지.\n" +
    'form: [{"i": 정수, "summary": "2문장 한국어 요약", "coins": ["BTC"]}]\n\n' + list;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || "claude-haiku-4-5",
      max_tokens: 3000,
      system: system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) return items;

  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  const arr = JSON.parse(json);
  const byI = new Map(arr.map((x) => [x.i, x]));
  return items.map((it, i) => {
    const s = byI.get(i);
    return s ? { ...it, summary: s.summary || "", coins: Array.isArray(s.coins) ? s.coins.slice(0, 4) : [] } : it;
  });
}
