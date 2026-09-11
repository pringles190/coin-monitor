# 업비트 관심코인 모니터

관심 코인의 가격·거래량을 한 화면에서 실시간 모니터링하는 웹앱(PWA).

- **대시보드**: 가격 변동률 + 거래량 추이(코인별 비교), 시세 2초 폴링, 캔들 90초 갱신
- **뉴스**: 국내·해외 암호화폐 뉴스 모음 (RSS, 15분 캐시). API 키가 있으면 AI 2문장 요약
- **관심도**: 구글 검색 관심도(Google Trends, 비공식) 시계열 — 관심 코인 최대 5개 비교
- 관심 코인 추가/삭제, 기간 전환(1H/4H/1D/1W/1M), 다크/라이트 자동
- PWA: 폰에서 "홈 화면에 추가" → 앱처럼 전체화면 실행

## 프록시가 필요한 이유

브라우저에서 `api.upbit.com`을 직접 부르면 CORS로 차단된다. 그래서 중계(프록시)를
거쳐야 한다. 배포 방식에 따라 셋 중 하나:

| 배포처 | 프록시 | 대시보드 설정 |
|---|---|---|
| **Cloudflare Pages** (repo 연결) | `functions/api/[[path]].js` 자동 | 불필요 (`/api` 자동) |
| **Deno Deploy** (repo 연결) | `main.ts` (정적 서빙 + `/api`) | 불필요 (`/api` 자동) |
| **Vercel** (repo 연결) | `api/[...path].js` 자동 | 불필요 (`/api` 자동) |
| **GitHub Pages** 등 정적 호스팅 | 없음 → 별도 Worker 필요 | [설정]에 Worker 주소 입력 |

`*.pages.dev` · `*.deno.dev` · `*.vercel.app` · `*.netlify.app` 도메인은 자동으로
같은 도메인의 `/api`를 쓴다. 그 외에는 [설정]에서 프록시 주소를 넣어야 한다.

### 독립형 Cloudflare Worker (GitHub Pages와 함께 쓸 때)

`dash.cloudflare.com → Workers & Pages → Create → Workers → "Hello World"` →
편집기 **전체 삭제(Ctrl+A → Delete)** 후 [`worker.js`](worker.js) 붙여넣기 → Deploy.
나온 `https://<이름>.workers.dev` 주소를 대시보드 **[설정]**에 입력.
(폰에서는 편집기가 코드를 망가뜨리니 PC에서 할 것.)

## 뉴스 페이지

`/news` 엔드포인트가 RSS를 모아 JSON으로 돌려준다. 소스: 블록미디어·토큰포스트·
Cointelegraph·CoinDesk·Decrypt·The Block·구글 뉴스(국내). 3일 이내 기사, 15분 캐시.

- **현재 구현: `worker.js` (Cloudflare Worker)만.** Pages/Deno/Vercel용은 아직 없음.
- 아무 것도 설정 안 하면 헤드라인 + 발췌문만 표시(요약 없이도 정상 동작).

**AI 요약(선택, 둘 중 하나)** — 있으면 한국어 2문장 요약 + 코인 태그로 바뀐다:

| 방식 | 설정 | 비용 |
|---|---|---|
| **Workers AI**(오픈소스 모델, 추천) | Worker → **Settings → Bindings → Add → Workers AI** → 변수 이름 **`AI`** → Deploy | Cloudflare 무료 한도 내에서 사실상 무료 (API 키 불필요) |
| Anthropic Claude | Settings → Variables 에 `ANTHROPIC_API_KEY`([발급](https://console.anthropic.com)) | 별도 종량 과금 (Claude Pro 구독과 무관) |

둘 다 설정돼 있으면 **Workers AI를 우선** 사용한다. 모델은 `NEWS_MODEL` 변수로 바꿀 수 있음
(Workers AI 기본값 `@cf/meta/llama-3.1-8b-instruct`, Claude 기본값 `claude-haiku-4-5`).

> Workers AI 응답 파싱은 제가 이 환경에서 직접 배포해 검증하지 못했습니다(바인딩은 실제 Worker
> 안에서만 동작). 문서화된 표준 형식대로 짰고 흔한 변형들도 방어적으로 처리했지만, 켰는데
> 요약이 안 붙으면 Worker의 **Logs**(실시간 로그)에 `summarize failed: ...` 메시지가 남으니
> 그 내용을 알려주시면 바로 고치겠습니다.

## 관심도 페이지 (구글 트렌드)

`/trends` 엔드포인트가 [구글 트렌드](https://trends.google.com)의 비공식 내부 API를
그대로 호출해 0~100 검색 관심도 시계열을 돌려준다(관심 코인 최대 5개, 구간 내 최고점=100
기준 상대 비교). 국내/전세계, 1·3·12개월 토글 가능.

- **공식 API가 없다.** pytrends류가 쓰는 비공식 엔드포인트라 언제든 바뀌거나 막힐 수 있음.
- **구글이 요청을 자주 429로 막는다.** 특히 짧은 시간에 몰리면. 그래서:
  - 첫 호출 시 세션 쿠키를 먼저 받아온 뒤 요청 (없으면 거의 항상 429)
  - 응답을 **6시간** 캐시 — 같은 코인 조합·지역·기간이면 재요청 안 함
  - 실패해도 자동 재시도하지 않음(더 막히는 걸 방지). 실패하면 잠시 후 수동 새로고침
- **현재 구현: `worker.js`만.** Pages/Deno/Vercel용은 없음.
- 키워드는 업비트 한글 코인명을 그대로 구글에 검색한 값 (예: "비트코인", "이더리움").

## 로컬 실행

```bash
python -m http.server 8777
# http://localhost:8777  (로컬은 api.upbit.com 직접 호출)
```

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 대시보드 전체 (HTML/CSS/JS 단일 파일) |
| `functions/api/[[path]].js` | Cloudflare Pages Function 프록시 |
| `main.ts` | Deno Deploy 엔트리포인트 (정적 + 프록시) |
| `api/[...path].js` | Vercel Serverless Function 프록시 |
| `worker.js` | 독립형 Cloudflare Worker 프록시 + `/news`(뉴스) + `/trends`(구글 관심도) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA |

## 참고

- 앱을 열어둔 동안만 갱신됩니다. 앱 종료 상태의 푸시 알림은 별도 백엔드 필요.
- 데이터 출처: [업비트 공개 API](https://docs.upbit.com/) — API 키 불필요
