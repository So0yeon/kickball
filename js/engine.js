/* ═══════════════════════════════════════════════════════════
   engine.js — 경기 엔진 (상태 관리 + 진행 로직)
   ─────────────────────────────────────────────────────────
   ▸ G           : 경기 상태(단일 소스). UI는 G만 보고 그린다.
   ▸ nextStep()  : "다음 상황 ▶" → 랜덤 이벤트 or 자동 플레이
   ▸ applyChoice : 플레이어 판단 처리 (정답/오답 → VAR)
   ▸ 헬퍼 함수   : events.js 의 apply() 가 사용하는 공용 API
   ═══════════════════════════════════════════════════════════ */

let G = null; // 전역 경기 상태

// ── 경기 상태 초기화 ────────────────────────────────────
function newGameState(name, mode, myClass, oppClass) {
  return {
    name, mode,                       // mode: 'final' | 'group'
    myTeam: myClass || `${name} 팀`,             // 우리 반 이름
    oppTeam: oppClass || pick(OPP_TEAMS),        // 상대 반 이름(미입력 시 예비 팀명)
    inning: 1, half: "top",           // top / bot
    myBatsFirst: chance(0.5),         // 선공/후공도 매번 랜덤!
    score: { me: 0, opp: 0 },
    outs: 0,
    bases: [false, false, false],     // [1루, 2루, 3루]
    fouls: 0,                         // 현재 타자의 파울/헛발질 누적
    pitcherWarned: false,
    correct: 0, total: 0,             // 판단 정확도
    seen: new Set(),                  // 등장한 이벤트 id
    flags: { doubleOut: false, tagup: false, captain: false,
             wasBehind: false, extra: false, forfeit: false, draw: false },
    stepInHalf: 0,
    awaiting: "step",                 // step | choice | over
    over: false,
    endgameAsked: false,              // 동점 처리 이벤트를 이미 물었는가
    newAchvs: [],                     // 이번 경기에서 새로 딴 업적
  };
}

function isMyOffense() {
  return (G.half === "top") === G.myBatsFirst;
}
function curSide() { return isMyOffense() ? "me" : "opp"; }

// ═══════════════ 경기 시작 ═══════════════
function startGame(name, mode, myClass, oppClass) {
  G = newGameState(name, mode, myClass, oppClass);
  UI.showScreen("screen-game");
  UI.renderAll();
  const first = isMyOffense() ? "우리 팀 선공!" : `${G.oppTeam} 선공, 우리는 수비 먼저!`;
  UI.showAutoResult("📣", "플레이 볼!",
    `${G.mode === "final" ? "🏆 서이초 발야구 리그 결승전" : "📋 조별 예선 경기"}!\n⚔️ ${G.myTeam}  VS  ${G.oppTeam}\n동전 던지기 결과 — ${first}\n\n${name} 플레이어, 매 순간 올바른 판단을 부탁해요!`);
  SFX.play("whistle");
}

// ═══════════════ 다음 상황 진행 ═══════════════
function nextStep() {
  if (G.over) return;
  G.awaiting = "step";

  // 0) 동점 처리 판단 직후: 무승부 종료 또는 연장전 돌입
  if (G._endAfter) { endGame(); return; }
  if (G._extendAfter) {
    G._extendAfter = false;
    G.half = "top"; G.inning++;
    UI.renderAll();
    UI.showAutoResult("🔥", `연장 ${G.inning}회초`,
      `연장전 시작! ${isMyOffense() ? "우리 팀 공격!" : `${G.oppTeam} 공격, 우리 수비!`}\n한 회씩 더 진행해 반드시 승부를 가립니다!`);
    SFX.play("whistle");
    return;
  }

  // 1) 3아웃 → 공수 교대 처리
  if (G.outs >= 3) { changeHalf(); return; }

  // 2) 판단 이벤트 선택 (아직 안 본 이벤트 우선)
  const side = isMyOffense() ? "off" : "def";
  const eligible = EVENTS.filter(e =>
    !G.seen.has(e.id) && (e.side === side || e.side === "any") && e.cond(G)
  );

  // 안 본 이벤트가 있으면 높은 확률(75%)로 등장 → 매 판 다른 순서!
  if (eligible.length && chance(0.75)) {
    const ev = pick(eligible);
    G.seen.add(ev.id);
    G.stepInHalf++;
    UI.showDecision(ev.build(G));
    return;
  }

  // 3) 자동 플레이 (판단 없이 흘러가는 경기 장면)
  G.stepInHalf++;
  autoPlay();
}

// ═══════════════ 자동 플레이 (랜덤 경기 장면) ═══════════════
function autoPlay() {
  const my = isMyOffense();
  const batter = my ? pick(chance(0.5) ? NAMES_M : NAMES_F) : `${G.oppTeam} 타자`;
  const r = Math.random();

  if (r < 0.26) {                                   // 안타
    UI.animKick("mid");
    const runs = advanceOnHit(1);
    UI.showAutoResult("⚡", my ? "우리 팀 안타!" : "상대 팀 안타",
      `${batter}의 깔끔한 안타! 1루 진루!${runs ? `\n주자가 홈을 밟아 ${runs}점 추가!` : ""}`);
    if (my) SFX.play("kick");
  } else if (r < 0.40) {                            // 2루타
    UI.animKick("far");
    const runs = advanceOnHit(2);
    UI.showAutoResult("💥", my ? "큼지막한 2루타!" : "상대의 장타...",
      `${batter}(이)가 시원하게 찼다! 타자는 규칙상 최대인 2루까지!${runs ? `\n${runs}점 추가!` : ""}`);
  } else if (r < 0.58) {                            // 땅볼 아웃
    UI.animKick("ground");
    addOuts(1);
    UI.showAutoResult("🧤", "땅볼 아웃",
      `${batter}의 타구를 수비가 침착하게 잡아 1루 송구! 아웃!`);
  } else if (r < 0.72) {                            // 플라이 아웃
    UI.animKick("fly");
    addOuts(1);
    UI.showAutoResult("🛫", "플라이 아웃",
      `높이 뜬 공을 수비수가 그대로 캐치! ${batter} 아웃!`);
  } else if (r < 0.88) {                            // 파울/헛발질
    G.fouls++;
    if (G.fouls >= 3) {
      G.fouls = 0;
      addOuts(1);
      UI.showAutoResult("🔴", "도합 3회, 아웃!",
        `${batter}, 파울·헛발질이 도합 3회가 되어 아웃! (규칙 5번)`);
    } else {
      UI.showAutoResult("〰️", pick(["파울!", "헛발질!"]),
        `${batter}의 타구가 빗나갔다! 현재 누적 ${G.fouls}회 — 도합 3회면 아웃이에요!`);
    }
  } else {                                          // 만루 만들기(홈 승부 이벤트 씨앗)
    G.bases = [true, true, chance(0.6) ? true : G.bases[2]];
    UI.showAutoResult("😮", my ? "연속 출루! 찬스!" : "위기! 주자가 쌓인다!",
      my ? "연속 안타로 주자가 쌓였다! 큰 점수 찬스!"
         : `${G.oppTeam}의 연속 안타! 주자가 가득 찼다... 집중 수비!`);
  }
  UI.renderAll();
}

// ═══════════════ 판단 처리 ═══════════════
function applyChoice(choice, btnEl) {
  G.total++;
  const good = !!choice.correct;
  if (good) G.correct++;

  UI.markChoice(btnEl, good);
  SFX.play(good ? "good" : "bad");

  // 몰수패 선택 → 즉시 경기 종료 (히든 엔딩)
  if (choice.forfeit) {
    setTimeout(() => {
      UI.showVAR(choice.explain, choice.rule, () => {
        G.flags.forfeit = true;
        endGame();
      });
    }, 650);
    return;
  }

  setTimeout(() => {
    choice.apply && choice.apply(G);
    UI.renderAll();
    if (good) {
      UI.toast(choice.result || "좋은 판단! 👍", "good");
      UI.setResultText(choice.result);
      afterPlay();
    } else {
      // 오답일 때만 VAR 슬로우모션 + 규칙 학습
      UI.showVAR(choice.explain, choice.rule, () => {
        UI.setResultText(choice.result);
        afterPlay();
      });
    }
  }, 700);
}

// 판단/플레이 뒤 공통 처리
function afterPlay() {
  if (G.over) return;
  UI.renderAll();
  G.awaiting = "step";
  UI.showNextButton();
}

// ═══════════════ 공수 교대 / 이닝 진행 ═══════════════
function changeHalf() {
  G.outs = 0; G.bases = [false, false, false]; G.fouls = 0; G.stepInHalf = 0;

  if (G.half === "top") {
    G.half = "bot";
  } else {
    // 한 이닝 종료 → 경기 종료 판정
    if (G.inning >= 5) {
      if (G.score.me !== G.score.opp) { endGame(); return; }
      // 동점! → 규칙 2번 판단 이벤트 (한 번만)
      if (!G.endgameAsked) { askEndgame(); return; }
      // 이미 물었다면: 조별=무승부 종료 / 결승=연장 진행
      if (G.mode === "group") { G.flags.draw = true; endGame(); return; }
      G.flags.extra = true;
      // 안전장치: 연장이 너무 길어지면(8회 종료 동점) 끝내기 상황 발생
      if (G.inning >= 8) {
        const meWins = chance(0.55);
        scoreRun(meWins ? "me" : "opp", 1);
        pushLog(meWins ? "🔥 끝내기 득점!! 기나긴 연장전의 마침표!" : "😭 상대의 끝내기... 아쉬운 연장 혈투!");
        endGame(); return;
      }
    }
    G.half = "top";
    G.inning++;
  }

  const off = isMyOffense() ? "우리 팀 공격" : `${G.oppTeam} 공격 (우리 수비)`;
  const extra = G.inning > 5 ? "🔥 연장전! " : "";
  UI.renderAll();
  UI.showAutoResult("🔁", `${extra}${G.inning}회${G.half === "top" ? "초" : "말"}`,
    `공수 교대! 이제 ${off}입니다.\n${isMyOffense() ? "득점 찬스를 노려요!" : "수비 집중! 실점을 막아요!"}`);
  SFX.play("whistle");
}

// 5회 종료 동점 → 규칙 2번(연장/무승부) 판단 이벤트
function askEndgame() {
  G.endgameAsked = true;
  const ev = G.mode === "group" ? ENDGAME_EVENTS.group_draw(G) : ENDGAME_EVENTS.final_extra(G);
  // 판단 후 진행 방향 결정
  ev.choices.forEach(c => {
    const orig = c.apply;
    c.apply = (S) => {
      orig && orig(S);
      if (G.mode === "group") { G.flags.draw = true; G._endAfter = true; }
      else { G.flags.extra = true; G._extendAfter = true; }
    };
  });
  UI.showDecision(ev);
}

// ═══════════════ 헬퍼 API (events.js 에서 사용) ═══════════════
function pushLog(msg) { UI.ticker(msg); }

function addOuts(n) {
  G.outs = Math.min(3, G.outs + n);
  G.fouls = 0;
  UI.renderAll();
  if (G.outs >= 3) UI.toast("3아웃! 공수 교대! 🔁");
}

function scoreRun(side, n) {
  G.score[side] += n;
  if (side === "me") { SFX.play("score"); UI.flashScore("me"); cheerCrowd(); }
  else { UI.flashScore("opp"); }
  if (G.score.me < G.score.opp) G.flags.wasBehind = true;
  UI.renderAll();
}

// 타자 안타 처리(타자는 최대 2루). 주자 자동 진루 + 득점 계산
function advanceOnHit(nBase) {
  nBase = Math.min(2, nBase);
  let runs = 0;
  const nb = [false, false, false];
  // 기존 주자: 제한 없이 진루(랜덤으로 한 베이스 더 가기도 함 → 매번 다른 경기!)
  for (let i = 2; i >= 0; i--) {
    if (!G.bases[i]) continue;
    const move = nBase + (chance(0.35) ? 1 : 0);
    const dest = i + move;
    if (dest >= 3) runs++;
    else nb[dest] = true;
  }
  nb[nBase - 1] = true; // 타자
  G.bases = nb;
  if (runs) scoreRun(curSide(), runs);
  G.fouls = 0;
  return runs;
}
function batterHit(n) { const r = advanceOnHit(n); return r; }

// 주자 조작 헬퍼
function moveRunner(from, to) { G.bases[from] = false; G.bases[to] = true; }
function removeRunnerAt(i) { G.bases[i] = false; }
function removeLeadRunner() {
  for (let i = 2; i >= 0; i--) if (G.bases[i]) { G.bases[i] = false; return; }
}
// 2·3루 주자가 홈까지 대시(규칙 4번 정답 연출)
function runnerScoreDash() {
  let runs = 0;
  if (G.bases[2]) { G.bases[2] = false; runs++; }
  if (G.bases[1]) { G.bases[1] = false; runs++; }
  G.bases[0] = true; // 타자는 1루에
  scoreRun("me", Math.max(1, runs));
}
// 상대에게 유리한 자동 진행(오답 페널티)
function oppHitAuto() {
  const runs = advanceOnHit(1);
  if (!runs && chance(0.5)) scoreRun("opp", 1);
}
// 만루 밀어내기 실점(수비 오답)
function forceAdvanceOpp() { scoreRun("opp", 1); G.bases = [true, true, chance(0.5)]; }

function cheerCrowd() { UI.cheer(); }

// 공 궤적 애니메이션 (events.js에서 바로 호출 가능하도록 전역 별칭)
function animKick(type) { UI.animKick(type); }

// ═══════════════ 경기 종료 & 엔딩 ═══════════════
function endGame() {
  G.over = true;
  G.awaiting = "over";

  const win = G.score.me > G.score.opp;
  const pct = G.total ? Math.round((G.correct / G.total) * 100) : 0;

  // 엔딩 결정
  let key;
  if (G.flags.forfeit) key = "forfeit";
  else if (G.flags.draw) key = "draw";
  else if (pct === 100 && win && G.score.opp === 0) key = "legend"; // 히든!
  else if (pct >= 95) key = "S";
  else if (pct >= 85) key = "A";
  else if (pct >= 70) key = "B";
  else if (pct >= 50) key = "C";
  else key = "D";

  // 업적 체크
  unlock("first_game");
  if (pct === 100 && G.total >= 8) unlock("rule_master");
  if (G.flags.doubleOut) unlock("double_out");
  if (G.flags.tagup) unlock("tagup");
  if (G.flags.captain) unlock("captain");
  if (G.flags.extra && win) unlock("extra_win");
  if (G.mode === "final" && win && !G.flags.forfeit) unlock("champion");
  if (win && G.score.opp === 0) unlock("shutout");
  if (G.total >= 12) unlock("explorer");
  if (G.flags.wasBehind && win) unlock("comeback");

  UI.showEnding(key, pct, win);
}

// ═══════════════ 업적 시스템 (localStorage) ═══════════════
function loadAchvs() {
  try { return JSON.parse(localStorage.getItem("kb_achievements") || "[]"); }
  catch { return []; }
}
function unlock(id) {
  const got = loadAchvs();
  if (got.includes(id)) return;
  got.push(id);
  localStorage.setItem("kb_achievements", JSON.stringify(got));
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (a) { G && G.newAchvs.push(a); UI.achvPopup(a); }
}
