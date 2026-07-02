# ⚽ 서이초 발야구 리그 결승전 — 규칙 학습 시뮬레이션 게임

퀴즈가 아니라 **실제 발야구 결승전을 뛰면서** 서이초 필수 규칙 13개를
자연스럽게 익히는 교육용 웹게임입니다.
(HTML + CSS + Vanilla JS, 외부 라이브러리 없음)

---

## 1. 실행 방법

압축을 푼 뒤 `index.html`을 브라우저(크롬 권장)로 열면 바로 실행됩니다.
서버가 필요 없으며, 학교 PC·태블릿·스마트폰 모두 반응형으로 동작합니다.

> 로컬 서버로 열고 싶다면: `python3 -m http.server` 후 `http://localhost:8000`

## 2. 게임 흐름

1. **이름 + 우리 반 + 상대 반 입력** → localStorage에 저장되어 다음에도 유지 (전광판·엔딩에 반 이름 표시)
2. **모드 선택** — 🏆 결승전(동점 시 연장전) / 📋 조별 예선(동점 시 무승부)
3. **경기 진행** — "다음 상황 ▶" 버튼으로 진행. 매 순간
   랜덤 이벤트(판단 상황) 또는 자동 플레이 장면이 등장
4. **판단** — 정답이면 짧은 토스트로 넘어가고,
   **오답일 때만 VAR 슬로우모션 + 규칙 설명**이 뜹니다
5. **엔딩** — 판단 정확도에 따라 S/A/B/C/D + 히든 엔딩(전설의 MVP, 몰수패 제조기, 무승부)
6. **업적** — 10종, localStorage에 영구 저장

### 게임에서 경험하는 규칙 (전부 랜덤 등장)
수비수 12명 · 남녀 교대 타순 · 5회/3아웃 · 조별 무승부/결승 연장 ·
공격 순서 위반 = 몰수패 · 이닝 후 수비 교체 · 주장만 항의 ·
투수 튀김 금지/경고 후 교체 · 파울·헛발질 도합 3회 아웃 · 도루 금지 ·
타자 최대 2루/주자 무제한 · 2/3 귀루 · 플라이 더블아웃 · 태그업 ·
만루 홈 승부(페어 지역 송구) · 2아웃 3루 주자 득점 불인정 · 스포츠맨십

## 3. 이미지 추가 방법 (코드 수정 불필요)

`assets/` 폴더에 PNG 파일만 넣으면 자동으로 실제 이미지가 표시됩니다.
파일이 없으면 이모지로 자동 대체됩니다(`smartImg()` onerror 처리).

| 파일명 | 위치 | 대체 이모지 |
|---|---|---|
| `assets/title.png` | 타이틀 로고 | ⚽ |
| `assets/trophy.png` | 엔딩 트로피 | 🏆 |

효과음도 마찬가지로 현재는 WebAudio 비프음이며,
`js/ui.js`의 `SFX` 객체에서 `assets/sfx_*.mp3` 로 쉽게 교체할 수 있습니다.

## 4. 파일 구조

```
kickball/
├── index.html      # 화면 구조 (타이틀/경기/VAR/엔딩/업적)
├── css/style.css   # 전광판·필드·카드·애니메이션·반응형
├── js/
│   ├── data.js     # 규칙 원문, 엔딩, 업적, 이름/팀/효과음 테이블
│   ├── events.js   # ★ 랜덤 판단 이벤트 19종 + 동점 처리 이벤트
│   ├── engine.js   # 경기 상태(G)·진행·판정·엔딩·업적 로직
│   ├── ui.js       # 렌더링·애니메이션·VAR·토스트·효과음
│   └── main.js     # 초기화·버튼 연결
└── assets/         # (비어 있음) PNG를 넣으면 자동 적용
```

## 5. 새 이벤트 추가하기

`js/events.js`의 `EVENTS` 배열에 객체 하나만 추가하면 됩니다.

```js
{
  id: "my_event",          // 고유 id
  side: "off",             // off(공격) | def(수비) | any
  once: true,              // 한 경기에 1회만
  cond: (S) => S.outs < 2, // 등장 조건 (S = 경기 상태 G)
  build: (S) => ({
    icon: "🎯", title: "상황 제목",
    text: `${S.name} 플레이어에게 보여줄 상황 설명`,
    choices: [
      { label: "정답 선택지", correct: true,
        result: "정답 연출 문구",
        apply: (S) => { batterHit(1); } },      // 경기 상태 변화
      { label: "오답 선택지", correct: false,
        result: "오답 결과 문구",
        explain: "VAR 화면에 뜨는 규칙 설명",
        rule: RULES.r4,                          // 관련 규칙 카드
        apply: (S) => { addOuts(1); } },
      // forfeit: true 를 주면 즉시 몰수패 엔딩
    ],
  }),
}
```

사용 가능한 헬퍼: `pushLog, addOuts, scoreRun, advanceOnHit, batterHit,
moveRunner, removeRunnerAt, removeLeadRunner, runnerScoreDash,
oppHitAuto, forceAdvanceOpp, cheerCrowd, animKick`

즐거운 수업 되세요! 🏆

> 선수 이름은 `js/data.js`의 `NAMES_M` / `NAMES_F` 배열(우리 반 실제 명단)에서 뽑힙니다.
> 남녀 구분이 다르면 두 배열 사이에서 이름만 옮기면 됩니다.
