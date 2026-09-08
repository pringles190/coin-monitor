# 업비트 관심코인 모니터

관심 코인의 가격·거래량을 한 화면에서 실시간 모니터링하는 정적 웹앱(PWA).

- 서버 불필요 — 브라우저에서 업비트 공개 API를 직접 호출
- 시세·거래량은 WebSocket 실시간, 캔들 히스토리는 90초마다 갱신
- 관심 코인 추가/삭제, 기간 전환(1H/4H/1D/1W/1M), 다크/라이트 자동
- PWA: 폰에서 "홈 화면에 추가" → 앱처럼 전체화면 실행

## 로컬 실행

```bash
python -m http.server 8777
# http://localhost:8777
```

## GitHub Pages 배포

1. GitHub에서 새 저장소 `coin-monitor` 생성 (Public)
2. 로컬에서 원격 연결 후 push:
   ```bash
   git remote add origin https://github.com/<사용자명>/coin-monitor.git
   git branch -M main
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Build and deployment**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)` → Save
4. 1~2분 뒤 `https://<사용자명>.github.io/coin-monitor/` 접속
5. 폰 브라우저에서 열고 공유 메뉴 → "홈 화면에 추가"

## 파일

| 파일 | 역할 |
|---|---|
| `index.html` | 대시보드 전체 (HTML/CSS/JS 단일 파일) |
| `manifest.webmanifest` | PWA 앱 정보 |
| `sw.js` | 서비스워커 (앱 셸 캐시, API는 항상 실시간) |
| `icon-*.png` | 앱 아이콘 |

## 참고

- 앱을 열어둔 동안만 갱신됩니다. 앱 종료 상태의 푸시 알림은 별도 백엔드 필요.
- 데이터 출처: [업비트 공개 API](https://docs.upbit.com/) — API 키 불필요
