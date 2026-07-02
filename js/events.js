/* ═══════════════════════════════════════════════════════════
   events.js — 랜덤 판단 이벤트 정의
   ─────────────────────────────────────────────────────────
   ▸ 모든 서이초 필수 규칙(1~13번) + 스포츠맨십을
     "실제 경기 상황 속 판단"으로 경험하게 만드는 이벤트 목록.
   ▸ 새 이벤트 추가 방법:
       EVENTS 배열에 아래 형식의 객체 하나만 추가하면 끝.
       {
         id: '고유아이디',
         side: 'off' | 'def' | 'any',   // 우리 팀 공격 / 수비 / 아무 때나
         once: true,                    // 한 경기 1회만 등장
         cond(S)  { return ...; },      // 등장 조건
         build(S) { return {icon, title, text, urgent, choices:[...]}; }
       }
   ▸ choice 형식:
       { label, correct, apply(S), result, explain, rule }
       - correct: true(정답) / false(오답)
       - apply : 선택 후 경기 상태 변화 (engine의 헬퍼 사용)
       - result: 티커/토스트에 흐를 결과 문구
       - explain/rule: 오답일 때 VAR 화면에 표시
   ═══════════════════════════════════════════════════════════ */

// 무작위 유틸
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return Math.random() < p; }

const EVENTS = [

  /* ── 규칙 1: 남녀 번갈아 타순 ─────────────────────────── */
  {
    id: "gender_order", side: "off", once: true,
    cond: (S) => S.inning === 1,
    build: (S) => ({
      icon: "📝", title: "타순 제출",
      text: `경기 전, 심판이 우리 팀 공격 순서표를 요구합니다.\n${S.name} 플레이어가 타순을 정해야 해요. 어떤 순서로 낼까요?`,
      choices: [
        { label: "남학생 전원 먼저, 그다음 여학생 순서로!", correct: false,
          result: "타순표 반려!",
          explain: "심판이 타순표를 돌려보냅니다.\n남녀가 함께하는 경기에서는 한쪽 성별이 몰아서 차면 안 돼요!",
          rule: RULES.r1,
          apply: () => pushLog("📋 타순표가 반려되어 다시 제출했다...") },
        { label: "남, 여(또는 여, 남) 순서로 번갈아 가며 전원이 차도록!", correct: true,
          result: "타순표 통과! 좋은 시작이에요 👍",
          apply: () => pushLog("📋 남녀 교대 타순표 제출 완료! 경기 시작!") },
        { label: "매 이닝 가위바위보로 정한다!", correct: false,
          result: "타순표 반려!",
          explain: "재밌어 보이지만 규칙 위반!\n공격 순서는 남녀가 번갈아 가며 전원이 실시하도록 정해져 있어요.",
          rule: RULES.r1,
          apply: () => pushLog("📋 가위바위보 타순은 반려되었다...") },
      ],
    }),
  },

  /* ── 규칙 1: 수비수 12명 제한 ─────────────────────────── */
  {
    id: "fielder_count", side: "def", once: true,
    cond: () => true,
    build: (S) => ({
      icon: "🧤", title: "수비 인원 배치",
      text: `수비 이닝 시작! "다 같이 들어가서 막자!"라는 의견이 나왔어요.\n경기장에는 몇 명이 들어가야 할까요?`,
      choices: [
        { label: "야구처럼 9명만 들어간다", correct: false,
          result: "수비 구멍 발생! 상대 안타 허용 😱",
          explain: "발야구는 야구와 달라요! 9명만 서면 수비 공간이 텅 비어 버립니다.",
          rule: RULES.r1,
          apply: (S) => { oppHitAuto(); } },
        { label: "규칙대로 최대 12명까지 들어간다", correct: true,
          result: "빈틈없는 12인 수비 완성! 🧱",
          apply: () => pushLog("🧤 수비수 12명 배치 완료! 철벽 수비!") },
        { label: "우리 반 전원 다 들어간다!", correct: false,
          result: "심판 호루라기! 🔴 인원 초과!",
          explain: "심판이 경기를 중단시켰어요.\n경기장에 들어가는 수비수는 12명으로 제한됩니다. 초과 인원은 나와야 해요!",
          rule: RULES.r1,
          apply: () => pushLog("🔴 인원 초과로 경기 중단... 12명으로 조정했다.") },
      ],
    }),
  },

  /* ── 규칙 8: 공격 순서 위반 = 몰수패 (위기 이벤트!) ───── */
  {
    id: "batting_order", side: "off", once: true,
    cond: (S) => S.inning >= 2,
    build: (S) => {
      const wrong = pick(NAMES_F), right = pick(NAMES_M);
      return {
        icon: "🚨", title: "타순 대혼란!", urgent: true,
        text: `다음 타자는 ${right}인데, 신이 난 ${wrong}(이)가 먼저 타석으로 뛰어나가고 있어요!\n"내가 먼저 찰래~!" 이대로 두면...?`,
        choices: [
          { label: `"괜찮아, 한 명쯤이야~" 그냥 차게 둔다`, correct: false, forfeit: true,
            result: "몰수패 선언...!",
            explain: `${wrong}(이)가 순서를 어기고 공을 차는 순간—\n심판의 긴 호루라기! 공격 순서 위반은 봐주는 것 없이 '몰수패'입니다.`,
            rule: RULES.r8,
            apply: () => {} },
          { label: `급히 불러 세운다! "순서 지켜! ${right} 차례야!"`, correct: true,
            result: "몰수패 위기를 막았다! 😮‍💨",
            apply: () => pushLog(`🚨 ${S.name} 플레이어의 재치로 몰수패 위기를 넘겼다!`) },
          { label: "심판 몰래 순서표를 바꿔치기한다", correct: false, forfeit: true,
            result: "몰수패 선언...!",
            explain: "순서표를 몰래 바꾸는 건 공격 순서 위반 + 스포츠맨십 위반!\n심판에게 들켜 그대로 몰수패가 선언되었습니다.",
            rule: RULES.r8,
            apply: () => {} },
        ],
      };
    },
  },

  /* ── 규칙 8: 공격 거부도 몰수패 ──────────────────────── */
  {
    id: "skip_batter", side: "off", once: true,
    cond: (S) => S.inning >= 3,
    build: (S) => {
      const shy = pick(NAMES_F);
      return {
        icon: "😢", title: "차기 싫어요...", urgent: true,
        text: `다음 타자 ${shy}(이)가 갑자기 "나 못 차겠어... 그냥 건너뛰면 안 돼?"라고 해요.\n${S.name} 플레이어, 어떻게 할까요?`,
        choices: [
          { label: "그래, 다음 친구가 대신 차자 (건너뛰기)", correct: false, forfeit: true,
            result: "몰수패 선언...!",
            explain: "선수 중 누군가가 공격을 하지 않고 건너뛰면 그 즉시 몰수패!\n전원이 반드시 공격에 참여해야 해요.",
            rule: RULES.r8,
            apply: () => {} },
          { label: `"천천히 해도 돼, 우리가 응원할게!" 격려해서 차게 한다`, correct: true,
            result: `${shy} 용기 내서 타석에! 파이팅! 💪`,
            apply: (S) => { pushLog(`💪 ${shy}(이)가 용기를 내 타석에 섰다!`); } },
        ],
      };
    },
  },

  /* ── 규칙 3: 도루 금지 ────────────────────────────────── */
  {
    id: "no_steal", side: "off", once: true,
    cond: (S) => S.bases[0] || S.bases[1],
    build: (S) => {
      const from = S.bases[0] ? "1루" : "2루";
      const to = S.bases[0] ? "2루" : "3루";
      return {
        icon: "🏃", title: "도루 유혹",
        text: `${S.name} 플레이어가 ${from} 주자! 상대 투수가 딴청을 피우고 있어요.\n"지금이야! 몰래 ${to}로 뛰어!" 벤치에서 누가 외칩니다. 어떻게 할까요?`,
        choices: [
          { label: `기회다! 투수가 던지기 전에 ${to}로 도루한다!`, correct: false,
            result: "도루 시도 → 그대로 아웃! 🔴",
            explain: "발야구에는 야구와 달리 '도루'가 없어요!\n주자는 공이 차이기 전까지 베이스에 발을 붙이고 있어야 합니다.",
            rule: RULES.r3,
            apply: (S) => { removeLeadRunner(); addOuts(1); } },
          { label: "베이스에 발을 딱 붙이고 기다린다", correct: true,
            result: "규칙대로 대기! 좋은 판단 👍",
            apply: () => pushLog("🦶 베이스에 발을 붙이고 침착하게 대기!") },
        ],
      };
    },
  },

  /* ── 규칙 4: 타자는 최대 2루 ─────────────────────────── */
  {
    id: "batter_max2", side: "off", once: true,
    cond: () => true,
    build: (S) => ({
      icon: "💥", title: "초대형 타구!",
      text: `${S.name} 플레이어의 발끝에 제대로 맞았다! ⚽ 공이 운동장 끝까지 데굴데굴~\n수비수가 허둥지둥 쫓아가는 사이, 벌써 2루가 눈앞! 어디까지 뛸까요?`,
      choices: [
        { label: "공이 저렇게 머니까 3루까지 간다!", correct: false,
          result: "3루에서 아웃 판정! 🔴",
          explain: "아무리 멀리 차도, 공을 찬 '타자'는 한 번에 최대 2루까지만 진루할 수 있어요.\n3루로 넘어가는 순간 아웃!",
          rule: RULES.r4,
          apply: (S) => { animKick("far"); addOuts(1); } },
        { label: "홈까지 전력 질주! 그라운드 홈런!", correct: false,
          result: "규칙 위반 아웃! 🔴",
          explain: "발야구에서 타자는 한 번에 최대 2루까지!\n홈까지 도는 그라운드 홈런은 없답니다.",
          rule: RULES.r4,
          apply: (S) => { animKick("far"); addOuts(1); } },
        { label: "규칙대로 2루에서 멈춘다!", correct: true,
          result: "깔끔한 2루타!! ⚡",
          apply: (S) => { animKick("far"); batterHit(2); } },
      ],
    }),
  },

  /* ── 규칙 4: 주자는 무제한 진루 ──────────────────────── */
  {
    id: "runner_unlimited", side: "off", once: true,
    cond: (S) => S.bases[1] || S.bases[2],
    build: (S) => {
      const from = S.bases[1] ? "2루" : "3루";
      return {
        icon: "🌪️", title: "홈이 보인다!",
        text: `${S.name} 플레이어가 ${from} 주자! 다음 타자가 공을 뻥! 차서 외야로 깊숙이 빠졌어요.\n타자는 2루까지밖에 못 가지만... 주자인 나는?`,
        choices: [
          { label: "주자도 타자처럼 2루씩만... 한 베이스만 간다", correct: false,
            result: "아까운 득점 기회를 놓쳤다 😭",
            explain: "타자는 최대 2루까지지만, 이미 나가 있던 '주자'는 제한 없이 진루할 수 있어요!\n홈까지 뛸 수 있는 기회였답니다.",
            rule: RULES.r4,
            apply: (S) => { animKick("far"); batterHit(1); } },
          { label: "주자는 제한 없다! 홈까지 전력 질주!", correct: true,
            result: "득점!!! 🎉 주자는 무제한 진루!",
            apply: (S) => { animKick("far"); runnerScoreDash(); } },
        ],
      };
    },
  },

  /* ── 규칙 4: 2/3 지점 귀루 판단 ──────────────────────── */
  {
    id: "two_thirds", side: "off", once: true,
    cond: (S) => S.bases[0],
    build: (S) => {
      const passed = chance(0.5); // 매 경기 상황이 달라짐!
      const pos = passed ? "3분의 2(2/3)를 훌쩍 넘은" : "아직 절반(1/2)쯤인";
      return {
        icon: "📏", title: "잡혔다! 계속 뛸까?",
        text: `${S.name} 플레이어가 1루에서 2루로 달리는 중—\n그 순간 수비수가 공을 딱! 잡았어요.\n지금 내 위치는 1루와 2루 사이 ${pos} 지점! 어떻게 할까요?`,
        choices: [
          { label: "그대로 2루까지 계속 뛴다!", correct: passed,
            result: passed ? "세이프! 2/3를 넘었으니 진루 인정! 🔵" : "아웃! 🔴 기준선을 못 넘었는데 뛰었다!",
            explain: "수비수가 공을 잡은 순간, 다음 누까지 2/3 이상 가지 못했다면\n욕심내지 말고 원래 베이스로 귀루해야 해요!",
            rule: RULES.r4,
            apply: (S) => {
              if (passed) { moveRunner(0, 1); pushLog("🔵 2/3 지점 통과! 2루 진루 인정!"); }
              else { removeRunnerAt(0); addOuts(1); }
            } },
          { label: "1루로 안전하게 귀루한다!", correct: !passed,
            result: !passed ? "현명한 귀루! 세이프! 🔵" : "귀루도 안전하지만... 2/3를 넘었으면 진루할 수 있었어요!",
            explain: "이미 2/3 지점을 넘었다면 당당하게 다음 베이스로 진루할 수 있어요!\n기준선을 기억하세요: 3분의 2!",
            rule: RULES.r4,
            apply: (S) => { pushLog("↩️ 1루로 귀루했다."); } },
        ],
      };
    },
  },

  /* ── 규칙 5: 파울/헛발질 도합 3회 = 아웃 ─────────────── */
  {
    id: "foul_count", side: "off", once: true,
    cond: () => true,
    build: (S) => ({
      icon: "🤔", title: "돌발 규칙 퀴즈 (심판의 확인)",
      text: `${S.name} 플레이어 타석. 방금 파울 2번을 기록했어요.\n심판: "타자, 파울·헛발질이 도합 몇 회면 아웃인지 알고 있나요?"`,
      choices: [
        { label: "파울은 몇 번을 해도 아웃되지 않아요!", correct: false,
          result: "그리고 세 번째 파울... 아웃! 🔴",
          explain: "헛발질, 파울 라인을 못 벗어남, 1·3루 라인 바깥으로 참—\n이런 것들이 '도합 3회'가 되면 아웃이에요!",
          rule: RULES.r5,
          apply: (S) => { addOuts(1); } },
        { label: "도합 3회면 아웃! 이번엔 신중하게 차야 해요", correct: true,
          result: "신중한 한 방! 안타!! ⚡",
          apply: (S) => { animKick("mid"); batterHit(1); } },
      ],
    }),
  },

  /* ── 규칙 5 응용: 멀리 굴러간 공은 정상 안타 ─────────── */
  {
    id: "far_ball", side: "off", once: true,
    cond: (S) => S.inning >= 2,
    build: (S) => {
      const mate = pick(NAMES_M);
      return {
        icon: "⚖️", title: "상대 팀의 항의",
        text: `우리 팀 ${mate}(이)가 수비수가 아무도 없는 먼 곳으로 공을 차서 2루까지 갔어요.\n상대 팀: "저렇게 아무도 없는 데로 차는 건 반칙! 파울이야!"\n주장인 ${S.name} 플레이어의 생각은?`,
        choices: [
          { label: "듣고 보니 그런 것 같아... 파울을 인정한다", correct: false,
            result: "정당한 안타를 스스로 무르다니! 😱",
            explain: "수비수가 없는 먼 곳으로 잘 굴러간 공은 반칙이 아니라 '정상적인 안타'!\n파울은 라인 기준(1·3루 라인 바깥, 라인 못 벗어남, 헛발질)으로만 판단해요.",
            rule: RULES.r5,
            apply: (S) => { pushLog("😱 멀쩡한 안타를 파울로 물렀다..."); } },
          { label: "페어 지역에 떨어진 정상 안타! 당당하게 설명한다", correct: true,
            result: "심판도 인정! 정상 안타 유지! 🔵",
            apply: (S) => { batterHit(2); pushLog(`⚖️ ${S.name} 주장의 정확한 규칙 설명! 안타 인정!`); } },
        ],
      };
    },
  },

  /* ── 규칙 12: 태그업 (공격) ──────────────────────────── */
  {
    id: "tagup_off", side: "off", once: true,
    cond: (S) => S.outs < 2 && S.bases[2],
    build: (S) => ({
      icon: "🛫", title: "높이 뜬 공! 태그업 찬스?",
      text: `현재 ${S.outs}아웃, ${S.name} 플레이어가 3루 주자!\n타자가 찬 공이 하늘 높이 떠올랐고, 외야수가 잡을 것 같아요.\n홈까지 한 베이스... 어떻게 움직일까요?`,
      choices: [
        { label: "잡히기 전에 미리 홈으로 출발한다!", correct: false,
          result: "더블아웃 헌납! 🔴🔴",
          explain: "수비수가 공을 잡기 전에 베이스를 떠나면,\n포구 후 3루로 공이 오는 순간 나까지 아웃(더블아웃)이에요!\n반드시 '포구를 확인한 후' 출발해야 합니다.",
          rule: RULES.r12,
          apply: (S) => { removeRunnerAt(2); addOuts(2); } },
        { label: "베이스를 밟고 있다가, 포구 확인 후 홈으로 태그업!", correct: true,
          result: "완벽한 태그업 득점!!! 🎉",
          apply: (S) => { addOuts(1); removeRunnerAt(2); scoreRun("me", 1); S.flags.tagup = true; pushLog(`🏃 ${S.name}의 교과서 태그업 득점!`); } },
        { label: "위험하니까 그냥 3루에 서 있는다", correct: false,
          result: "아웃은 늘었지만 득점 기회는 날아갔다 😥",
          explain: "0아웃·1아웃의 플라이는 오히려 기회!\n포구를 확인한 뒤 태그업하면 규칙에 맞게 다음 베이스로 진루(득점)할 수 있어요.",
          rule: RULES.r12,
          apply: (S) => { addOuts(1); } },
      ],
    }),
  },

  /* ── 규칙 13: 2아웃 3루주자 득점 불인정 ──────────────── */
  {
    id: "two_out_score", side: "off", once: true,
    cond: (S) => S.outs === 2 && S.bases[2],
    build: (S) => {
      const runnerDesc = S.bases[0] && S.bases[1] ? "만루" : (S.bases[1] ? "2·3루" : "3루");
      return {
        icon: "🧑‍⚖️", title: "이 점수, 인정될까?",
        text: `2아웃 ${runnerDesc} 상황! 타자가 공을 찼고—\n3루 주자가 번개처럼 달려 홈을 먼저 밟았어요! ⚡\n하지만 타자는 1루에 닿기 전에 공에 잡혀 3아웃...\n심판이 주장 ${S.name}에게 묻습니다. "이 득점, 인정입니까?"`,
        choices: [
          { label: "홈을 먼저 밟았으니 당연히 1점 인정!", correct: false,
            result: "득점 무효! 전광판에서 1점이 사라진다... 🔴",
            explain: "2아웃에서 타자가 1루에서 아웃되어 3아웃이 되면,\n그 전에 주자가 홈을 밟았어도 득점으로 인정되지 않아요!\n주자가 3루·2,3루·만루 어디에 있든 똑같습니다.",
            rule: RULES.r13,
            apply: (S) => { addOuts(1); pushLog("🔴 2아웃 규칙! 득점 불인정으로 정정."); } },
          { label: "타자가 1루에서 아웃됐으니 득점 인정 안 돼요", correct: true,
            result: "정확한 규칙 판단! 심판이 감탄한다 👏",
            apply: (S) => { addOuts(1); pushLog(`🧑‍⚖️ ${S.name}의 정확한 판단! 2아웃 득점 불인정 규칙!`); } },
        ],
      };
    },
  },

  /* ── 규칙 11: 항의는 주장을 통해 ────────────────────── */
  {
    id: "protest", side: "any", once: true,
    cond: (S) => S.inning >= 2,
    build: (S) => ({
      icon: "😤", title: "억울한 판정!",
      text: `아슬아슬한 세이프 상황이 아웃으로 판정됐어요!\n팀원들이 씩씩거리며 심판에게 우르르 달려가려고 해요.\n주장 ${S.name} 플레이어, 어떻게 해야 할까요?`,
      urgent: true,
      choices: [
        { label: "다 같이 달려가서 큰소리로 항의한다!!", correct: false,
          result: "팀 전체 경고! 분위기 최악... 🔴",
          explain: "여러 명이 몰려가 항의하면 경기가 엉망이 돼요.\n판정에 이의가 있을 땐 감정을 가라앉히고 반드시 '주장'을 통해서만!",
          rule: RULES.r11,
          apply: (S) => { pushLog("🔴 단체 항의로 팀 경고를 받았다..."); } },
        { label: "주장인 내가 혼자, 차분하게 심판에게 여쭤본다", correct: true,
          result: "심판이 정중한 태도에 판정을 다시 확인해 줬다! 👏",
          apply: (S) => { S.flags.captain = true; pushLog(`🎖️ 주장 ${S.name}의 품격 있는 이의 제기!`); } },
        { label: "벤치의 선생님께 대신 항의해 달라고 조른다", correct: false,
          result: "선생님: \"그건 주장이 하는 거란다~\" 😅",
          explain: "판정 이의 제기는 선생님도, 팀원 전체도 아닌\n반드시 팀의 '주장'을 통해서 하는 것이 규칙이에요.",
          rule: RULES.r11,
          apply: (S) => { pushLog("😅 선생님께 혼나고 주장이 다시 항의했다."); } },
      ],
    }),
  },

  /* ── 스포츠맨십 ──────────────────────────────────────── */
  {
    id: "sportsmanship", side: "any", once: true,
    cond: (S) => S.total >= 2,
    build: (S) => {
      const mate = pick(NAMES_M), mate2 = pick(NAMES_F);
      return {
        icon: "💚", title: "친구의 실수",
        text: `${mate}(이)가 쉬운 공을 놓치는 실수를 했어요.\n${mate2}(이)가 "야! 너 때문에 졌잖아!"라며 화를 내기 시작합니다.\n${S.name} 플레이어는?`,
        choices: [
          { label: "나도 같이 한마디 한다. 답답하니까!", correct: false,
            result: "팀 분위기 붕괴... 다음 플레이도 흔들린다 📉",
            explain: "실수한 친구를 비난하면 팀 전체가 무너져요.\n규칙을 지키고 서로 배려하는 것이 진짜 스포츠맨십!",
            rule: RULES.spirit,
            apply: (S) => { pushLog("📉 팀 분위기가 가라앉았다..."); } },
          { label: `"괜찮아! 다음에 잡으면 돼!" 어깨를 두드려 준다`, correct: true,
            result: "팀 사기 UP! 관중석에서도 박수가! 👏",
            apply: (S) => { cheerCrowd(); pushLog("💚 따뜻한 격려에 팀 사기가 올랐다!"); } },
        ],
      };
    },
  },

  /* ── 규칙 10: 투수 투구 방법 ─────────────────────────── */
  {
    id: "pitcher_style", side: "def", once: true,
    cond: () => true,
    build: (S) => ({
      icon: "🤾", title: "마운드의 나",
      text: `이번 이닝은 ${S.name} 플레이어가 투수!\n상대 에이스 타자가 타석에 들어섰어요. 어떻게 던질까요?`,
      choices: [
        { label: "바닥에 통통 튀겨서 차기 어렵게 던진다!", correct: false,
          result: "심판 경고! 🟨 (누적되면 투수 교체!)",
          explain: "공을 튀기거나 빠르게 던지는 것은 금지!\n투수는 타자가 찰 수 있도록 공정하게 굴려야 해요. 경고 1회!",
          rule: RULES.r10,
          apply: (S) => { S.pitcherWarned = true; pushLog("🟨 투수 경고 1회 누적!"); } },
        { label: "총알처럼 빠르게 던져서 헛발질을 유도한다!", correct: false,
          result: "심판 경고! 🟨 (누적되면 투수 교체!)",
          explain: "너무 빠른 공도 규칙 위반!\n공은 적당한 속도로 정확하게 굴려 줘야 합니다. 경고 1회!",
          rule: RULES.r10,
          apply: (S) => { S.pitcherWarned = true; pushLog("🟨 투수 경고 1회 누적!"); } },
        { label: "타자가 찰 수 있게 부드럽고 정확하게 굴린다", correct: true,
          result: "공정한 투구! 그리고 우리 수비가 타구를 잡아냈다! 🔵",
          apply: (S) => { addOuts(1); pushLog("🤾 공정한 투구 → 깔끔한 수비 아웃!"); } },
      ],
    }),
  },

  /* ── 규칙 10: 경고 후 재위반 = 투수 교체 ─────────────── */
  {
    id: "pitcher_warned", side: "def", once: true,
    cond: (S) => S.pitcherWarned,
    build: (S) => ({
      icon: "🟨", title: "투수, 또 위반!",
      text: `경고를 받았던 우리 투수가 또! 공을 튀겨서 던졌어요.\n심판이 우리 벤치를 바라봅니다. 어떻게 해야 할까요?`,
      urgent: true,
      choices: [
        { label: `"한 번만 봐주세요~" 사정해 본다`, correct: false,
          result: "규칙은 규칙! 강제 교체 + 상대 분위기 UP 🔴",
          explain: "경고 1회를 받은 후에도 다시 위반하면 반드시 투수를 교체해야 해요.\n사정한다고 되는 게 아니랍니다!",
          rule: RULES.r10,
          apply: (S) => { S.pitcherWarned = false; oppHitAuto(); pushLog("🔴 어수선한 분위기 속 실점 위기!"); } },
        { label: "규칙대로 투수를 교체한다", correct: true,
          result: "깔끔한 규칙 이행! 새 투수가 호투! 🔵",
          apply: (S) => { S.pitcherWarned = false; addOuts(1); pushLog("🔄 규칙에 따라 투수 교체! 새 투수 첫 타자 처리!"); } },
      ],
    }),
  },

  /* ── 규칙 9: 수비 교체는 이닝 종료 후 ────────────────── */
  {
    id: "sub_timing", side: "def", once: true,
    cond: (S) => S.outs >= 1,
    build: (S) => {
      const sub = pick(NAMES_M);
      return {
        icon: "🔄", title: "지금 바꿔줘!",
        text: `수비 도중, 벤치의 ${sub}(이)가 외칩니다.\n"나도 수비하고 싶어! 지금 바로 바꿔줘!"\n주자도 없겠다, 지금 교체해도 될까요?`,
        choices: [
          { label: "주자도 없으니 지금 바로 교체해 준다", correct: false,
            result: "심판 제지! 🔴 이닝 중 교체 불가!",
            explain: "수비수 교체는 한 이닝이 완전히 끝난 후에만 자유롭게 가능해요.\n이닝 중간에는 주자가 없어도 교체할 수 없습니다!",
            rule: RULES.r9,
            apply: (S) => { pushLog("🔴 이닝 중 교체 시도로 경기가 중단됐다..."); } },
          { label: `"이닝 끝나고 바로 넣어 줄게!" 기다리게 한다`, correct: true,
            result: "규칙대로! 이닝 종료 후 교체 예약 완료 🔵",
            apply: (S) => { pushLog(`🔄 ${sub}, 이닝 종료 후 투입 예약!`); } },
        ],
      };
    },
  },

  /* ── 규칙 6: 플라이 더블아웃 (수비) ──────────────────── */
  {
    id: "double_out", side: "def", once: true,
    cond: (S) => S.outs < 2 && S.bases[0],
    build: (S) => ({
      icon: "🧤", title: "플라이 캐치!! 다음 플레이는?",
      text: `상대 타자의 뜬공을 ${S.name} 플레이어가 멋지게 캐치! (타자 아웃!)\n그런데 1루 주자가 멀리 나와 있다가 허둥지둥 돌아가는 중이에요!\n공을 어디로?`,
      urgent: true,
      choices: [
        { label: "잡았으니 끝! 투수에게 공을 돌려준다", correct: false,
          result: "아쉽다! 더블아웃 기회를 놓쳤다 😥",
          explain: "플라이 아웃 시, 주자가 원래 베이스로 돌아가기(귀루) 전에\n그 베이스로 공을 던져 먼저 도착시키면 주자까지 아웃!\n'더블아웃' 대찬스였어요!",
          rule: RULES.r6,
          apply: (S) => { addOuts(1); } },
        { label: "주자가 돌아가기 전에 1루로 번개 송구!!", correct: true,
          result: "더!블!아!웃!!! 🔥🔥 한 번에 아웃 2개!",
          apply: (S) => { removeRunnerAt(0); addOuts(2); S.flags.doubleOut = true; cheerCrowd(); pushLog("🔥 더블아웃 작렬! 관중석이 뒤집어졌다!"); } },
        { label: "주자를 직접 쫓아가서 태그한다", correct: false,
          result: "발이 느렸다! 주자 귀루 성공 😥",
          explain: "쫓아가는 것보다 확실한 방법이 있어요.\n귀루 전에 '베이스로 공을 먼저 보내면' 더블아웃이 됩니다!",
          rule: RULES.r6,
          apply: (S) => { addOuts(1); } },
      ],
    }),
  },

  /* ── 규칙 7: 만루 홈 승부 — 송구 경로 ────────────────── */
  {
    id: "home_throw", side: "def", once: true,
    cond: (S) => S.bases[0] && S.bases[1] && S.bases[2],
    build: (S) => ({
      icon: "🏠", title: "만루 대위기! 홈 승부!",
      text: `만루에서 상대 타자가 공을 찼고, 3루 주자가 홈으로 파고듭니다!\n${S.name} 플레이어가 공을 잡았어요! 홈으로 던져야 하는데—\n어떤 경로로 던질까요?`,
      urgent: true,
      choices: [
        { label: "파울 지역(라인 바깥)을 크게 돌아서 홈으로!", correct: false,
          result: "무효 송구! 주자 세이프, 1실점... 🔴",
          explain: "만루 홈 승부의 송구는 반드시 1·3루 라인 '안쪽(페어 지역)'을\n거쳐서 홈에 도달해야 인정돼요! 바깥 경로는 무효!",
          rule: RULES.r7,
          apply: (S) => { forceAdvanceOpp(); } },
        { label: "1·3루 라인 안쪽(페어 지역)으로 정확히 홈 송구!", correct: true,
          result: "공이 먼저 홈에!! 포스 아웃!! 🔵",
          apply: (S) => { removeRunnerAt(2); addOuts(1); cheerCrowd(); pushLog("🏠 페어 지역 정확 송구로 홈 아웃! 위기 탈출!"); } },
        { label: "주자 몸에 공을 던져서 맞힌다!", correct: false,
          result: "위험 행동 + 무효! 주자 세이프... 🔴",
          explain: "주자 몸에 맞히는 건 위험하고 규칙에도 없어요!\n만루에서는 공이 주자보다 '홈에 먼저 도착'하면 아웃이랍니다.\n(경로는 1·3루 라인 안쪽!)",
          rule: RULES.r7,
          apply: (S) => { forceAdvanceOpp(); } },
      ],
    }),
  },

  /* ── 규칙 12 응용: 상대의 태그업을 수비로 막기 ───────── */
  {
    id: "tagup_def", side: "def", once: true,
    cond: (S) => S.outs < 2 && S.bases[2],
    build: (S) => ({
      icon: "👀", title: "상대 주자가 노린다!",
      text: `${S.outs}아웃, 상대 주자가 3루에!\n우리 외야수가 높이 뜬 공을 잡았어요. (타자 아웃!)\n그 순간, 3루 주자가 베이스를 밟고 있다가 홈으로 출발하려 해요!`,
      urgent: true,
      choices: [
        { label: "플라이 아웃이면 주자는 절대 못 뛰니까 천천히 걸어온다", correct: false,
          result: "상대 태그업 성공! 1실점 🔴",
          explain: "0아웃·1아웃의 플라이 아웃에서는 상대 주자도\n포구 후 태그업으로 진루(득점)할 수 있어요!\n방심은 금물, 바로 홈으로 대비해야 합니다.",
          rule: RULES.r12,
          apply: (S) => { addOuts(1); removeRunnerAt(2); scoreRun("opp", 1); } },
        { label: "태그업이다! 즉시 홈으로 강하게 송구!", correct: true,
          result: "홈에서 태그업 저지 성공!! 🔵",
          apply: (S) => { addOuts(1); removeRunnerAt(2); cheerCrowd(); pushLog("👀 상대 태그업을 읽고 홈에서 저지!"); } },
      ],
    }),
  },

  /* ── 규칙 2: 3아웃 공수교대 확인 ─────────────────────── */
  {
    id: "change_sides", side: "any", once: true,
    cond: (S) => S.outs === 2,
    build: (S) => ({
      icon: "🔁", title: "심판의 확인 질문",
      text: `현재 2아웃! 심판이 양 팀에 확인합니다.\n"몇 아웃이 되면 공수 교대이고, 정식 경기는 몇 회까지인지 알고 있나요?"`,
      choices: [
        { label: "2아웃 교대 / 7회까지!", correct: false,
          result: "심판: \"다시 공부해 오세요~\" 😅",
          explain: "발야구 한 회는 '3아웃'으로 공수가 교대되고,\n정식 경기는 '5회'까지 진행돼요!",
          rule: RULES.r2,
          apply: () => {} },
        { label: "3아웃 교대 / 5회까지!", correct: true,
          result: "정확합니다! 경기 재개! ▶",
          apply: () => pushLog("🔁 3아웃 교대·5회 경기, 완벽 숙지!") },
        { label: "3아웃 교대 / 9회까지!", correct: false,
          result: "심판: \"9회는 프로야구죠~\" 😅",
          explain: "공수 교대는 3아웃이 맞지만, 서이초 발야구 정식 경기는\n야구(9회)와 달리 '5회'까지 진행됩니다!",
          rule: RULES.r2,
          apply: () => {} },
      ],
    }),
  },
];

/* ── 경기 종료 시 강제 등장하는 특수 이벤트 (동점 처리) ───
   engine에서 직접 호출한다. */
const ENDGAME_EVENTS = {
  // 조별 예선 동점
  group_draw: (S) => ({
    icon: "⚖️", title: "5회 종료, 동점!",
    text: `조별 예선 경기가 ${S.score.me} : ${S.score.opp} 동점으로 끝났어요.\n상대 팀이 "연장전 하자!"고 외칩니다. 규칙상 어떻게 처리해야 할까요?`,
    choices: [
      { label: "좋아! 연장전으로 승부를 가른다!", correct: false,
        result: "조별 예선엔 연장전이 없어요!",
        explain: "연장전은 '본선(토너먼트)'에만 있어요.\n조별 예선은 연장전 없이 무승부로 처리합니다!",
        rule: RULES.r2,
        apply: () => {} },
      { label: "조별 예선은 연장전 없이 무승부 처리!", correct: true,
        result: "정확한 규칙 적용! 무승부로 경기 종료 🤝",
        apply: () => pushLog("🤝 조별 예선 규칙에 따라 무승부!") },
    ],
  }),
  // 토너먼트(결승) 동점
  final_extra: (S) => ({
    icon: "⏱️", title: "5회 종료, 결승전 동점!",
    text: `결승전이 ${S.score.me} : ${S.score.opp} 동점!\n누군가 "무승부니까 공동 우승으로 하자!"고 해요. 규칙상 어떻게 해야 할까요?`,
    choices: [
      { label: "공동 우승! 사이좋게 끝낸다", correct: false,
        result: "본선은 승부를 가려야 해요!",
        explain: "본선(토너먼트)에서 무승부가 되면\n한 회씩 더 진행하는 '연장전'으로 반드시 승부를 가립니다!",
        rule: RULES.r2,
        apply: () => {} },
      { label: "한 회씩 더 진행하는 연장전으로 승부를 가린다!", correct: true,
        result: "연장전 돌입!! 🔥 집중력을 유지하세요!",
        apply: () => pushLog("⏱️ 규칙에 따라 연장전 돌입!") },
    ],
  }),
};
