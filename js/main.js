/* ═══════════════════════════════════════════════════════════
   main.js — 초기화 & 화면 연결
   ═══════════════════════════════════════════════════════════ */

let selectedMode = "final";

document.addEventListener("DOMContentLoaded", () => {

  /* ── 타이틀 로고: assets/title.png 있으면 이미지, 없으면 ⚽ ── */
  $("title-logo").appendChild(smartImg("assets/title.png", "⚽", "78px"));

  /* ── 이름/반 자동 복원 (localStorage) ── */
  const nameInput = $("player-name");
  const myClassInput = $("my-class");
  const oppClassInput = $("opp-class");
  nameInput.value = localStorage.getItem("kb_player_name") || "";
  myClassInput.value = localStorage.getItem("kb_my_class") || "";
  oppClassInput.value = localStorage.getItem("kb_opp_class") || "";

  /* ── 모드 선택 ── */
  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedMode = btn.dataset.mode;
    };
  });

  /* ── 경기 시작 ── */
  $("btn-start").onclick = () => {
    const name = nameInput.value.trim();
    const myClass = myClassInput.value.trim();
    const oppClass = oppClassInput.value.trim();
    if (!name) {
      UI.toast("이름을 입력해 주세요! ✏️", "bad");
      nameInput.focus();
      return;
    }
    if (!myClass) {
      UI.toast("우리 반을 입력해 주세요! 🏫", "bad");
      myClassInput.focus();
      return;
    }
    if (!oppClass) {
      UI.toast("상대 반을 입력해 주세요! 🆚", "bad");
      oppClassInput.focus();
      return;
    }
    localStorage.setItem("kb_player_name", name);
    localStorage.setItem("kb_my_class", myClass);
    localStorage.setItem("kb_opp_class", oppClass);
    fillCrowd();
    startGame(name, selectedMode, myClass, oppClass);
  };
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") $("btn-start").click(); });

  /* ── 경기 진행 버튼 ── */
  $("btn-next").onclick = () => {
    $("btn-next").classList.remove("show");
    nextStep();
  };

  /* ── 효과음 토글 ── */
  $("btn-sound").onclick = () => {
    SFX.on = !SFX.on;
    $("btn-sound").textContent = SFX.on ? "🔊" : "🔇";
    UI.toast(SFX.on ? "효과음 켜짐 🔊" : "효과음 꺼짐 🔇");
  };

  /* ── 경기 포기(처음으로) ── */
  $("btn-quit").onclick = () => {
    if (confirm("경기를 포기하고 처음 화면으로 돌아갈까요?")) {
      UI.showScreen("screen-title");
    }
  };

  /* ── 엔딩 버튼 ── */
  $("btn-replay").onclick = () => {
    fillCrowd();
    startGame(G.name, G.mode, G.myTeam, G.oppTeam); // 같은 대진으로 재경기 (상황은 전부 새로 랜덤!)
  };
  $("btn-home").onclick = () => UI.showScreen("screen-title");

  /* ── 업적 모달 ── */
  $("btn-achievements").onclick = () => {
    UI.renderAchvList();
    $("achv-modal").classList.add("active");
  };
  $("btn-achv-close").onclick = () => $("achv-modal").classList.remove("active");
});
