# 업비트 관심코인 모니터

관심 코인의 가격·거래량을 한 화면에서 실시간 모니터링하는 웹앱(PWA).

- 가격 변동률 + 거래량 추이(코인별 비교: 평균 대비 배수 / 원화 로그)를 한 화면에
- 시세 2초 폴링, 캔들 히스토리 90초 갱신
- 관심 코인 추가/삭제, 기간 전환(1H/4H/1D/1W/1M), 다크/라이트 자동
- PWA: 폰에서 "홈 화면에 추가" → 앱처럼 전체화면 실행

## 구조

브라우저가 `api.upbit.com`을 직접 부르면 CORS로 차단된다. 그래서 같은 도메인의
`/api` 경로로 요청하고, **Cloudflare Pages Function**(`functions/api/[[path]].js`)이
서버 사이드에서 업비트로 중계한다.

```
브라우저  →  /api/v1/...  (Cloudflare Pages Function)  →  api.upbit.com
```

같은 출처라 CORS도 없고, 프록시 주소를 따로 설정할 필요도 없다.

## 배포 — Cloudflare Pages (권장)

1. <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git**
2. 이 저장소(`coin-monitor`) 선택 → **Begin setup**
3. 빌드 설정:
   - Framework preset: **None**
   - Build command: **(비움)**
   - Build output directory: **`/`**
4. **Save and Deploy** → 1~2분 뒤 `https://coin-monitor.pages.dev` 접속
5. 이후 `git push` 할 때마다 자동 재배포. `functions/` 폴더는 자동 인식됨.

폰에서 `pages.dev` 주소를 열고 공유 메뉴 → "홈 화면에 추가".

### GitHub Pages를 쓴다면

`functions/`가 동작하지 않으므로 별도 프록시가 필요하다. `worker.js`를 Cloudflare
Worker로 배포하고(`dash.cloudflare.com → Create → Worker`), 그 주소를 대시보드
**[설정]** 의 프록시 입력란에 넣는다.

## 로컬 실행

```bash
python -m http.server 8777
# http://localhost:8777  (로컬에서는 api.upbit.com 직접 호출)
```

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 대시보드 전체 (HTML/CSS/JS 단일 파일) |
| `functions/api/[[path]].js` | Cloudflare Pages Function — 업비트 API 중계 |
| `worker.js` | (대안) 독립형 Cloudflare Worker 프록시 |
| `manifest.webmanifest` | PWA 앱 정보 |
| `sw.js` | 서비스워커 (앱 셸만 캐시, API 응답은 캐시 안 함) |
| `icon-*.png` | 앱 아이콘 |

## 참고

- 앱을 열어둔 동안만 갱신됩니다. 앱 종료 상태의 푸시 알림은 별도 백엔드 필요.
- 데이터 출처: [업비트 공개 API](https://docs.upbit.com/) — API 키 불필요
- Cloudflare 무료 플랜: 하루 10만 요청. 2초 폴링 ≈ 하루 4.3만 요청.
