/* ═══════════════════════════════════════════════════════════
   ui.js — 화면 렌더링 / 애니메이션 / 이미지 대체 / 효과음
   ─────────────────────────────────────────────────────────
   ▸ UI.*   : 모든 DOM 조작은 여기로 모은다 (engine은 상태만 관리)
   ▸ smartImg : assets/*.png 가 있으면 이미지, 없으면 이모지 자동 대체
   ▸ SFX    : WebAudio 비프음. 실제 음원(assets/sfx_*.mp3) 자리 확보.
   ═══════════════════════════════════════════════════════════ */

const $ = (id) => document.getElementById(id);

/* ── 이미지 → 이모지 자동 대체 시스템 ──────────────────────
   assets 폴더에 png를 넣기만 하면 코드 수정 없이 이미지가 뜨고,
   없으면 onerror 로 이모지 Placeholder 가 자연스럽게 표시된다. */
function smartImg(src, emoji, fontSize) {
  const wrap = document.createElement("span");
  wrap.className = "smart-img";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.onerror = () => {
    img.remove();
    const ph = document.createElement("span");
    ph.className = "ph-emoji";
    ph.textContent = emoji;
    if (fontSize) ph.style.fontSize = fontSize;
    wrap.appendChild(ph);
  };
  wrap.appendChild(img);
  return wrap;
}

/* ── 효과음 (WebAudio 비프 — 음원 파일 교체 가능 구조) ──── */
const SFX = {
  on: true, ctx: null,
  play(name) {
    if (!this.on) return;
    const def = SFX_TABLE[name];
    if (!def) return;
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = def.type; o.frequency.value = def.freq;
      g.gain.setValueAtTime(0.12, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + def.dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + def.dur);
    } catch (e) { /* 오디오 미지원 환경 무시 */ }
  },
};

const UI = {

  /* ═══ 화면 전환 ═══ */
  showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    $(id).classList.add("active");
    window.scrollTo(0, 0);
  },

  /* ═══ 전광판 + 필드 전체 렌더 ═══ */
  renderAll() {
    if (!G) return;
    const extra = G.inning > 5 ? "연장 " : "";
    $("sb-inning").textContent = `${extra}${G.inning}회${G.half === "top" ? "초" : "말"}`;
    const ph = $("sb-phase");
    ph.textContent = isMyOffense() ? "공격 ⚽" : "수비 🧤";
    ph.classList.toggle("defense", !isMyOffense());
    $("sb-name-me").textContent = G.myTeam;
    $("sb-name-opp").textContent = G.oppTeam;
    $("sb-score-me").textContent = G.score.me;
    $("sb-score-opp").textContent = G.score.opp;

    // 아웃 램프
    document.querySelectorAll(".out-lamp").forEach((l, i) => l.classList.toggle("on", i < G.outs));

    // 주자 (필드 + 미니 다이아몬드)
    [0, 1, 2].forEach(i => {
      const r = $(`runner-${i + 1}`);
      r.textContent = pickRunnerEmoji(i);
      r.classList.toggle("show", G.bases[i]);
      $(`mb-${i + 1}`).classList.toggle("on", G.bases[i]);
    });
  },

  /* ═══ 상황 카드: 자동 플레이 결과 ═══ */
  showAutoResult(icon, title, text) {
    G.awaiting = "step";
    $("situ-icon").textContent = icon;
    $("situ-title").textContent = title;
    const b = $("situ-text");
    b.textContent = text;
    b.classList.remove("urgent");
    $("situ-choices").innerHTML = "";
    this.replayCardAnim();
    this.showNextButton();
  },

  /* ═══ 상황 카드: 판단 이벤트 ═══ */
  showDecision(situ) {
    G.awaiting = "choice";
    $("situ-icon").textContent = situ.icon;
    $("situ-title").textContent = situ.title;
    const b = $("situ-text");
    b.textContent = situ.text;
    b.classList.toggle("urgent", !!situ.urgent);
    $("btn-next").classList.remove("show");

    const box = $("situ-choices");
    box.innerHTML = "";
    // 선택지 순서도 매번 섞는다 → 위치 암기 방지!
    const shuffled = [...situ.choices].sort(() => Math.random() - 0.5);
    shuffled.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.className = "choice-btn";
      btn.innerHTML = `<span class="ch-key">${i + 1}</span><span>${c.label}</span>`;
      btn.onclick = () => {
        if (G.awaiting !== "choice") return;
        G.awaiting = "resolving";
        box.querySelectorAll("button").forEach(x => x.disabled = true);
        applyChoice(c, btn);
      };
      box.appendChild(btn);
    });
    this.replayCardAnim();
    if (situ.urgent) SFX.play("whistle");
  },

  markChoice(btn, good) { btn.classList.add(good ? "picked-good" : "picked-bad"); },

  setResultText(text) {
    if (!text) return;
    $("situ-text").textContent += `\n\n▶ ${text}`;
  },

  showNextButton() {
    if (G && G.over) return;
    $("btn-next").classList.add("show");
  },

  replayCardAnim() {
    const card = $("situation");
    card.style.animation = "none";
    void card.offsetWidth; // 리플로우로 애니메이션 재시작
    card.style.animation = "";
  },

  /* ═══ VAR 오버레이 (오답 학습 화면) ═══ */
  showVAR(explain, rule, onClose) {
    $("var-explain").textContent = explain || "";
    $("var-rule").textContent = rule || "";
    $("var-replay").textContent = pick(["🐢 슬로우 모션 리플레이...", "📼 되감기... ◀◀", "🔍 판정 정밀 분석 중..."]);
    $("var-overlay").classList.add("active");
    SFX.play("bad");
    $("btn-var-ok").onclick = () => {
      $("var-overlay").classList.remove("active");
      onClose && onClose();
    };
  },

  /* ═══ 토스트 / 티커 ═══ */
  toast(msg, type) {
    const t = $("toast");
    t.textContent = msg;
    t.className = `toast show ${type || ""}`;
    clearTimeout(t._tm);
    t._tm = setTimeout(() => t.classList.remove("show"), 1800);
  },

  ticker(msg) {
    const t = $("ticker-track");
    t.textContent = `📢 ${msg}`;
    t.style.animation = "none";
    void t.offsetWidth;
    t.style.animation = "";
  },

  /* ═══ 점수 반짝 + 관중 환호 + 색종이 ═══ */
  flashScore(side) {
    const el = $(side === "me" ? "sb-score-me" : "sb-score-opp");
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  },

  cheer() {
    const c = $("crowd");
    c.classList.remove("cheer"); void c.offsetWidth; c.classList.add("cheer");
    SFX.play("crowd");
    const layer = $("cheer-layer");
    for (let i = 0; i < 14; i++) {
      const bit = document.createElement("span");
      bit.className = "confetti-bit";
      bit.textContent = pick(["🎉", "✨", "⭐", "👏", "🎊"]);
      bit.style.left = Math.random() * 96 + "%";
      bit.style.animationDuration = (0.9 + Math.random()) + "s";
      layer.appendChild(bit);
      setTimeout(() => bit.remove(), 2200);
    }
  },

  /* ═══ 공 애니메이션 ═══ */
  animKick(type) {
    const ball = $("ball");
    const batter = $("batter-icon");
    batter.classList.remove("kick"); void batter.offsetWidth; batter.classList.add("kick");
    SFX.play("kick");

    // 홈 위치에서 시작
    ball.style.transition = "none";
    ball.style.left = "50%"; ball.style.top = "92%"; ball.style.fontSize = "20px";
    void ball.offsetWidth;
    ball.style.transition = "";
    ball.classList.remove("spin"); void ball.offsetWidth; ball.classList.add("spin");

    const spots = {
      mid:    { left: (30 + Math.random() * 40) + "%", top: "35%", size: "18px" },
      far:    { left: (Math.random() < .5 ? 8 : 82) + "%", top: "6%", size: "13px" },
      fly:    { left: (35 + Math.random() * 30) + "%", top: "8%", size: "30px" },
      ground: { left: (25 + Math.random() * 50) + "%", top: "55%", size: "17px" },
    };
    const s = spots[type] || spots.mid;
    requestAnimationFrame(() => {
      ball.style.left = s.left; ball.style.top = s.top; ball.style.fontSize = s.size;
    });
    // 잠시 후 홈으로 복귀
    setTimeout(() => { ball.style.left = "50%"; ball.style.top = "92%"; ball.style.fontSize = "20px"; }, 1400);
  },

  /* ═══ 엔딩 화면 ═══ */
  showEnding(key, pct, win) {
    const e = ENDINGS[key];
    this.showScreen("screen-ending");

    // 트로피: assets/trophy.png 가 있으면 이미지, 없으면 이모지
    const tr = $("ending-trophy");
    tr.innerHTML = "";
    tr.appendChild(smartImg("assets/trophy.png", e.trophy, "80px"));

    $("ending-grade").textContent = e.grade;
    $("ending-title").textContent = e.title + (e.hidden ? " (히든 엔딩!)" : "");
    $("ending-msg").textContent =
      e.msg.replaceAll("{name}", G.name) +
      `\n\n최종 스코어  ${G.myTeam} ${G.score.me} : ${G.score.opp} ${G.oppTeam}` +
      (G.flags.forfeit ? "" : (G.flags.draw ? "  (무승부)" : (win ? "  🏆 승리!" : "  패배...")));

    $("ending-stats").innerHTML = `
      <div class="stat-card"><b>${G.correct}/${G.total}</b><span>올바른 판단</span></div>
      <div class="stat-card"><b>${pct}%</b><span>판단 정확도</span></div>
      <div class="stat-card"><b>${G.seen.size}</b><span>경험한 상황</span></div>`;

    const totalEv = EVENTS.length;
    $("ending-rules").innerHTML =
      `이번 경기에서 만난 규칙 상황 ${G.seen.size} / ${totalEv} — 다시 플레이하면 새로운 상황이 나와요!
       <div class="bar"><i style="width:0%"></i></div>`;
    setTimeout(() => {
      const bar = $("ending-rules").querySelector("i");
      if (bar) bar.style.width = Math.round(G.seen.size / totalEv * 100) + "%";
    }, 300);

    const achvBox = $("ending-achv");
    achvBox.innerHTML = "";
    G.newAchvs.forEach((a, i) => {
      const chip = document.createElement("span");
      chip.className = "achv-chip";
      chip.style.animationDelay = (i * 0.15) + "s";
      chip.textContent = `${a.icon} 새 업적: ${a.name}`;
      achvBox.appendChild(chip);
    });

    if (win || key === "legend" || key === "S") {
      this.endingConfetti();
      SFX.play("score");
    }
  },

  endingConfetti() {
    const layer = $("ending-confetti");
    layer.innerHTML = "";
    for (let i = 0; i < 26; i++) {
      const bit = document.createElement("span");
      bit.className = "confetti-bit";
      bit.textContent = pick(["🎉", "🎊", "⭐", "🏆", "✨"]);
      bit.style.left = Math.random() * 100 + "%";
      bit.style.animationDuration = (1.4 + Math.random() * 1.6) + "s";
      layer.appendChild(bit);
    }
    setTimeout(() => layer.innerHTML = "", 3600);
  },

  /* ═══ 업적 ═══ */
  achvPopup(a) {
    const p = $("achv-popup");
    p.textContent = `🎖️ 업적 달성! ${a.icon} ${a.name}`;
    p.classList.add("show");
    SFX.play("good");
    clearTimeout(p._tm);
    p._tm = setTimeout(() => p.classList.remove("show"), 2400);
  },

  renderAchvList() {
    const got = loadAchvs();
    const box = $("achv-list");
    box.innerHTML = "";
    ACHIEVEMENTS.forEach(a => {
      const has = got.includes(a.id);
      const div = document.createElement("div");
      div.className = "achv-item" + (has ? "" : " locked");
      div.innerHTML = `<span class="ai-icon">${a.icon}</span>
        <div><b>${a.name}</b><span>${has ? a.desc : "???"}</span></div>`;
      box.appendChild(div);
    });
  },
};

/* 필드 위 주자 이모지 (자리마다 조금씩 다르게) */
function pickRunnerEmoji(i) { return ["🏃", "🏃‍♀️", "🏃‍♂️"][i % 3]; }

/* 관중석 채우기 */
function fillCrowd() {
  const c = $("crowd");
  let s = "";
  for (let i = 0; i < 40; i++) s += pick(["🧑", "👧", "👦", "🧒", "👏"]);
  c.textContent = s;
}
