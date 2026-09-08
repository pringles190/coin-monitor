# 업비트 관심코인 모니터

관심 코인의 가격·거래량을 한 화면에서 실시간 모니터링하는 웹앱(PWA).

- **대시보드**: 가격 변동률 + 거래량 추이(코인별 비교), 시세 2초 폴링, 캔들 90초 갱신
- **뉴스**: 국내·해외 암호화폐 뉴스 모음 (RSS, 15분 캐시). API 키가 있으면 AI 2문장 요약
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
- 키 없으면 헤드라인 + 발췌문만 표시.
- **AI 요약(선택)**: Worker의 Settings → Variables 에
  `ANTHROPIC_API_KEY` (console.anthropic.com 발급) 추가 → 한국어 2문장 요약 + 코인 태그.
  모델 기본 `claude-haiku-4-5`, `NEWS_MODEL` 로 변경 가능.
  비용은 [Anthropic API](https://console.anthropic.com) 별도 과금 (Claude Pro 구독과 무관).
  Haiku + 15분 캐시 기준 실제 열람량에 따라 하루 수십~수백 원 수준.

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
| `worker.js` | 독립형 Cloudflare Worker 프록시 + `/news` (뉴스 모음·AI 요약) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PWA |

## 참고

- 앱을 열어둔 동안만 갱신됩니다. 앱 종료 상태의 푸시 알림은 별도 백엔드 필요.
- 데이터 출처: [업비트 공개 API](https://docs.upbit.com/) — API 키 불필요
