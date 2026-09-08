# 업비트 관심코인 모니터

관심 코인의 가격·거래량을 한 화면에서 실시간 모니터링하는 정적 웹앱(PWA).

- 가격 변동률 + 거래량 추이(코인별 비교: 평균 대비 배수 / 원화 로그)를 한 화면에
- 시세 2초 폴링, 캔들 히스토리 90초 갱신
- 관심 코인 추가/삭제, 기간 전환(1H/4H/1D/1W/1M), 다크/라이트 자동
- PWA: 폰에서 "홈 화면에 추가" → 앱처럼 전체화면 실행

## 구조

정적 페이지(`index.html`)는 서버가 없다. 대신 **Cloudflare Worker 프록시**(`worker.js`)를
거쳐 업비트 API를 호출한다. 브라우저가 `api.upbit.com`을 직접 부르면 CORS로 차단되기 때문.

```
브라우저(GitHub Pages)  →  Cloudflare Worker  →  api.upbit.com
```

## 1. Cloudflare Worker 프록시 배포 (CLI 불필요)

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Worker**
2. 이름 입력(예: `coin-proxy`) → **Deploy**
3. **Edit code** → 편집기 내용을 지우고 [`worker.js`](worker.js) 전체 붙여넣기 → **Deploy**
4. 배포 주소 복사: `https://coin-proxy.<계정>.workers.dev`
   - 무료 플랜 하루 10만 요청. 2초 폴링이면 하루 약 4만 3천 요청.

## 2. GitHub Pages 배포

이미 배포돼 있으면 `git push`만 하면 자동 갱신된다. 최초 설정:

```bash
git remote add origin https://github.com/<사용자명>/coin-monitor.git
git push -u origin main
```

저장소 **Settings → Pages** → Source: `Deploy from a branch`, Branch: `main` / `/(root)`.

1~2분 뒤 `https://<사용자명>.github.io/coin-monitor/` 접속.

## 3. 프록시 주소 연결

대시보드 우상단 **[설정]** → 프록시 입력란에 1번에서 복사한 Worker 주소 붙여넣기 → **저장**.
브라우저에 저장되므로(로컬스토리지) 한 번만 하면 된다.

## 로컬 실행

```bash
python -m http.server 8777
# http://localhost:8777  (로컬에서는 프록시 없이 직접 호출도 동작)
```

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 대시보드 전체 (HTML/CSS/JS 단일 파일) |
| `worker.js` | Cloudflare Worker — 업비트 API CORS 프록시 |
| `manifest.webmanifest` | PWA 앱 정보 |
| `sw.js` | 서비스워커 (앱 셸만 캐시, API 응답은 캐시 안 함) |
| `icon-*.png` | 앱 아이콘 |

## 참고

- 앱을 열어둔 동안만 갱신됩니다. 앱 종료 상태의 푸시 알림은 별도 백엔드 필요.
- 데이터 출처: [업비트 공개 API](https://docs.upbit.com/) — API 키 불필요
- Worker 접근을 본인 페이지로 제한하려면 `worker.js`의 `ALLOW_ORIGIN`을 수정.
