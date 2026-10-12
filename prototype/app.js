const state = {
  homeSort: "curriculum",
  drafts: {},
  formError: "",
  lastResult: null,
  mistakes: [],
  baseline: null,
  grading: false,
  gradeService: "checking",
};

function allPoints(chapter) {
  return chapter.groups.flatMap((group) => group.points);
}

function findKp(id) {
  for (const chapter of this.CHAPTERS) {
    for (const group of chapter.groups) {
      for (const kp of group.points) {
        if (kp.id === id) return { chapter, group, kp };
      }
    }
  }
  return null;
}

function classScore(kp) {
  return kp.classScore == null ? null : kp.classScore;
}

function pointScore(kp, mode) {
  return mode === "class" ? classScore(kp) : kp.score;
}

function summarize(points, mode) {
  const started = points.filter((kp) => pointScore(kp, mode) != null);
  const mastery = started.length
    ? started.reduce((sum, kp) => sum + pointScore(kp, mode), 0) / started.length
    : null;
  return { mastery, started: started.length, total: points.length };
}

function overall(mode) {
  let weighted = 0;
  let hours = 0;
  for (const chapter of this.CHAPTERS) {
    const stats = summarize(allPoints(chapter), mode);
    if (stats.mastery == null) continue;
    weighted += stats.mastery * chapter.hours;
    hours += chapter.hours;
  }
  return hours ? weighted / hours : null;
}

function coverage(mode) {
  let started = 0;
  let total = 0;
  for (const chapter of this.CHAPTERS) {
    const stats = summarize(allPoints(chapter), mode);
    started += stats.started;
    total += stats.total;
  }
  return { started, total };
}

function weakPoints(mode) {
  const list = [];
  for (const chapter of this.CHAPTERS) {
    for (const kp of allPoints(chapter)) {
      const score = pointScore(kp, mode);
      if (score != null && score < 40) list.push({ chapter, kp, score });
    }
  }
  list.sort((a, b) => a.score - b.score);
  return list;
}

function band(kp) {
  if (!kp.n || kp.score == null) return { key: "none", label: "未開始" };
  if (kp.score >= 85 && kp.n >= 4) return { key: "mastered", label: "掌握" };
  if (kp.score >= 85) return { key: "early", label: "初步掌握" };
  if (kp.score >= 70) return { key: "steady", label: "穩定" };
  if (kp.score >= 40) return { key: "developing", label: "發展中" };
  return { key: "weak", label: "初學" };
}

function bandForScore(score) {
  if (score == null) return { key: "none", label: "未開始" };
  if (score >= 85) return { key: "mastered", label: "掌握" };
  if (score >= 70) return { key: "steady", label: "穩定" };
  if (score >= 40) return { key: "developing", label: "發展中" };
  return { key: "weak", label: "初學" };
}

function pctText(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return String(Math.round(value));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function route() {
  const parts = (location.hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  const name = parts[0] || "home";
  if (name === "chapter") return { name, id: parts[1] };
  if (name === "practice") return { name, id: parts[1] || this.QUESTIONS[0].id };
  if (name === "mistakes") return { name, filter: parts[1] || "all" };
  if (name === "class") return { name: "class" };
  if (name === "settings") return { name: "settings" };
  return { name: "home" };
}

function chapterById(id) {
  return this.CHAPTERS.find((chapter) => chapter.id === id) || null;
}

function questionById(id) {
  return this.QUESTIONS.find((question) => question.id === id) || this.QUESTIONS[0];
}

function lowestPoint(chapter) {
  const started = allPoints(chapter).filter((kp) => kp.score != null);
  if (!started.length) return null;
  return started.reduce((lowest, kp) => (kp.score < lowest.score ? kp : lowest));
}

function openMistakes() {
  return state.mistakes.filter((item) => item.status !== "mastered");
}

function freezeClassScores() {
  for (const chapter of this.CHAPTERS) {
    for (const kp of allPoints(chapter)) {
      if (kp.score == null) {
        kp.classScore = null;
        continue;
      }
      const delta = kp.classDelta == null ? -2 : kp.classDelta;
      kp.classScore = Math.max(0, Math.min(100, Math.round(kp.score + delta)));
    }
  }
}

function cloneData() {
  freezeClassScores();
  state.baseline = JSON.stringify({
    chapters: this.CHAPTERS.map((chapter) => ({
      id: chapter.id,
      points: allPoints(chapter).map((kp) => ({ id: kp.id, score: kp.score, n: kp.n })),
    })),
    mistakes: this.MISTAKES,
  });
  state.mistakes = this.MISTAKES.map((item) => ({ ...item }));
}

function restoreData() {
  const saved = JSON.parse(state.baseline);
  for (const chapter of saved.chapters) {
    for (const point of chapter.points) {
      const found = findKp(point.id);
      found.kp.score = point.score;
      found.kp.n = point.n;
    }
  }
  state.mistakes = saved.mistakes.map((item) => ({ ...item }));
  state.drafts = {};
  state.formError = "";
  state.lastResult = null;
}

function recordAttempt(kp, ratio) {
  const add = Math.round(ratio * 100);
  if (kp.score == null || !kp.n) {
    kp.score = add;
    kp.n = 1;
    return;
  }
  kp.score = Math.round((kp.score * kp.n + add) / (kp.n + 1));
  kp.n += 1;
}

function syncMistake(question, graded) {
  const full = graded.earned === graded.marks;
  let item = state.mistakes.find((entry) => entry.questionId === question.id);
  if (full) {
    if (item) {
      item.status = "mastered";
      item.score = graded.earned + "/" + graded.marks;
      item.reason = "重做後已拿滿分";
      item.when = "剛剛";
    }
    return item;
  }
  if (!item) {
    item = {
      id: "live-" + question.id,
      questionId: question.id,
      chapterId: question.chapterId,
      kpId: question.kpId,
      title: question.title,
      type: question.type === "mc" ? "選擇" : question.type === "numeric" ? "數值" : "結構",
      status: "retry",
      reason: graded.reason,
      score: graded.earned + "/" + graded.marks,
      when: "剛剛",
    };
    state.mistakes.unshift(item);
    return item;
  }
  item.status = "again";
  item.reason = graded.reason;
  item.score = graded.earned + "/" + graded.marks;
  item.when = "剛剛";
  return item;
}

function render() {
  const current = route();
  const main = document.querySelector("#main");
  const titles = {
    home: "掌握情況",
    chapter: "課題",
    practice: "做題",
    mistakes: "錯題本",
    class: "班別",
    settings: "DeepSeek",
  };
  document.title = titles[current.name] + " · FunLearning 物理";
  for (const link of document.querySelectorAll(".nav a")) {
    const key = link.dataset.route;
    const on =
      key === current.name || (key === "home" && current.name === "chapter");
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  document.querySelector("#mistake-count").textContent = String(openMistakes().length);
  const keyState = document.querySelector("#deepseek-state");
  if (keyState) {
    const labels = { checking: "檢查中", ready: "已接上", missing: "未設定", down: "未接上" };
    keyState.textContent = labels[state.gradeService] || "未接上";
    keyState.classList.toggle("on", state.gradeService === "ready");
  }
  if (current.name === "chapter") main.innerHTML = renderChapter(current.id);
  else if (current.name === "practice") main.innerHTML = renderPractice(current.id);
  else if (current.name === "mistakes") main.innerHTML = renderMistakes(current.filter);
  else if (current.name === "class") main.innerHTML = renderClass();
  else if (current.name === "settings") main.innerHTML = renderSettings();
  else main.innerHTML = renderHome();
  main.focus({ preventScroll: true });
}

function renderHome() {
  const chapters =
    state.homeSort === "weak"
      ? this.CHAPTERS.slice().sort((a, b) => {
          const sa = summarize(allPoints(a), "student").mastery;
          const sb = summarize(allPoints(b), "student").mastery;
          if (sa == null) return -1;
          if (sb == null) return 1;
          return sa - sb;
        })
      : this.CHAPTERS;
  const cover = coverage("student");
  const weak = weakPoints("student");
  const rows = chapters
    .map((chapter) => {
      const stats = summarize(allPoints(chapter), "student");
      const low = lowestPoint(chapter);
      const width = stats.mastery == null ? 0 : Math.round(stats.mastery);
      const sub = low
        ? "最弱：" + low.name + " · 覆蓋 " + stats.started + "/" + stats.total + " · " + chapter.hours + " 小時"
        : "未開始 · " + chapter.hours + " 小時";
      return (
        '<a class="chapter-row" href="#/chapter/' +
        chapter.id +
        '">' +
        '<img src="' +
        chapter.image +
        '" alt="' +
        esc(chapter.alt) +
        '" width="96" height="96">' +
        '<span class="idx" style="color:' +
        chapter.color +
        '">' +
        chapter.index +
        "</span>" +
        '<span><span class="chapter-name">' +
        esc(chapter.name) +
        '</span><span class="chapter-sub">' +
        esc(sub) +
        '</span><span class="bar"><span style="width:' +
        width +
        "%;background:" +
        chapter.color +
        '"></span></span></span>' +
        '<span class="pct">' +
        pctText(stats.mastery) +
        "<small>%</small></span></a>"
      );
    })
    .join("");
  return (
    '<div class="wrap">' +
    '<div class="page-head"><div><p class="kicker">必修部分 · 五個課題 · 184 小時</p><h1>掌握情況</h1>' +
    '<p class="lede">示範學生。課題百分比是已作答知識點的平均得分率，整體再按課題時數加權。未做過的知識點計入覆蓋，不計入得分率。</p></div>' +
    '<div class="segmented" role="group" aria-label="排列">' +
    '<button type="button" data-sort="curriculum" aria-pressed="' +
    (state.homeSort === "curriculum") +
    '">課題順序</button>' +
    '<button type="button" data-sort="weak" aria-pressed="' +
    (state.homeSort === "weak") +
    '">先看薄弱</button></div></div>' +
    '<ul class="stats"><li class="stat"><b>' +
    pctText(overall("student")) +
    '<small>%</small></b><span>整體掌握</span></li><li class="stat"><b>' +
    weak.length +
    '</b><span>初學知識點</span></li><li class="stat"><b>' +
    cover.started +
    "/" +
    cover.total +
    '</b><span>知識點覆蓋</span></li></ul>' +
    '<div class="chapter-list">' +
    rows +
    "</div>" +
    '<p class="note">示例成績用來定畫面。做題頁交一卷之後，對應知識點的得分率會按累計平均更新；正式版改為最近 8 次、越近越重。選修部分不在這版。</p></div>'
  );
}

function renderChapter(id) {
  const chapter = chapterById(id);
  if (!chapter) return '<div class="wrap"><p>找不到這個課題。</p></div>';
  const stats = summarize(allPoints(chapter), "student");
  const groups = chapter.groups
    .map((group) => {
      const rows = group.points
        .map((kp) => {
          const label = band(kp);
          const width = kp.score == null ? 0 : Math.round(kp.score);
          return (
            '<div class="kp"><span class="kp-name">' +
            esc(kp.name) +
            '</span><span class="band ' +
            label.key +
            '">' +
            label.label +
            '</span><span class="bar"><span style="width:' +
            width +
            "%;background:" +
            chapter.color +
            '"></span></span><span class="pct">' +
            pctText(kp.score) +
            '<small>%</small></span><span class="tries">' +
            (kp.n ? kp.n + " 次" : "") +
            "</span></div>"
          );
        })
        .join("");
      return '<h2 class="group-label">（' + group.code + "）" + esc(group.name) + "</h2>" + rows;
    })
    .join("");
  return (
    '<div class="wrap"><a class="back" href="#/">返回掌握情況</a><div class="hero"><img src="' +
    chapter.image +
    '" alt="' +
    esc(chapter.alt) +
    '" width="220" height="220"><div><p class="idx" style="color:' +
    chapter.color +
    '">' +
    chapter.index +
    "</p><h1>" +
    esc(chapter.name) +
    '</h1><p class="hero-meta">' +
    chapter.hours +
    " 小時 · 掌握 " +
    pctText(stats.mastery) +
    "% · 覆蓋 " +
    stats.started +
    "/" +
    stats.total +
    "</p></div></div>" +
    '<div class="legend"><span><i style="background:#9a3412"></i>初學，40% 以下</span><span><i style="background:#8a5a22"></i>發展中</span><span><i style="background:#1e4e86"></i>穩定，或未滿 4 次的初步掌握</span><span><i style="background:#0e6b5c"></i>掌握，85% 或以上而且至少 4 次</span></div>' +
    groups +
    '<p class="note">課題掌握只平均已經做過的知識點。掌握需要得分率至少 85%，而且至少做過 4 次。</p></div>'
  );
}

function renderPractice(id) {
  const question = questionById(id);
  const found = findKp(question.kpId);
  const draft = state.drafts[question.id] || {};
  const index = this.QUESTIONS.map((item, number) => {
    const current = item.id === question.id ? ' aria-current="page"' : "";
    return (
      '<a href="#/practice/' +
      item.id +
      '"' +
      current +
      '><span class="q-no">0' +
      (number + 1) +
      " · " +
      esc(item.grader) +
      "</span><strong>" +
      esc(item.title) +
      "</strong><em>" +
      esc(found && item.id === question.id ? found.chapter.name : chapterById(item.chapterId).name) +
      "</em></a>"
    );
  }).join("");
  return (
    '<div class="wrap"><p class="kicker">三題示範，分別走選擇、數值、結構</p><h1>做題</h1>' +
    '<p class="lede">選擇題和數值題由程式對答案，數值題可以認出常見錯法。結構題正式批改時，把評分準則和學生答案送給模型；這一題先用同一份準則做要點對照。原型為了離線示範，答案放在頁面裡；正式版答案和評分準則只留在伺服器。</p>' +
    '<nav class="q-index">' +
    index +
    "</nav>" +
    '<article class="question"><p class="kicker">' +
    esc(found.chapter.name) +
    " · " +
    esc(found.kp.name) +
    " · " +
    question.marks +
    ' 分</p><h2>' +
    esc(question.title) +
    '</h2><p class="stem">' +
    esc(question.stem) +
    "</p>" +
    graderNote(question) +
    '<form class="answer" data-qid="' +
    question.id +
    '">' +
    renderFields(question, draft) +
    (state.formError && state.lastResult == null
      ? '<p class="form-error">' + esc(state.formError) + "</p>"
      : state.formError
        ? '<p class="form-error">' + esc(state.formError) + "</p>"
        : "") +
    '<div class="actions"><button class="btn" type="submit"' +
    (state.grading ? " disabled" : "") +
    ">" +
    (state.grading ? "批改中…" : "批改這題") +
    "</button></div></form>" +
    renderResult(question) +
    "</article></div>"
  );
}

function graderNote(question) {
  if (question.type === "structured") {
    if (deepseekReady()) {
      return '<p class="grader-note">這題由伺服器上的 DeepSeek 按評分準則批改。網頁裡沒有金鑰，送出的是題目、準則和這次答案。</p>';
    }
    return '<p class="grader-note">批改服務尚未接上，這次先用要點對照。金鑰放在伺服器，學生頁面裡看不到。</p>';
  }
  if (question.type === "numeric") {
    return '<p class="grader-note">程式核對最終數值和單位。可辨認的錯步會按題目設定給部分分，並寫出錯在哪一步。</p>';
  }
  return '<p class="grader-note">選擇題即時對答案，不呼叫模型。</p>';
}

function renderFields(question, draft) {
  if (question.type === "mc") {
    return (
      '<ul class="choices">' +
      question.choices
        .map((choice) => {
          const checked = draft.choice === choice.id ? " checked" : "";
          return (
            '<li><label class="choice"><input type="radio" name="choice" value="' +
            choice.id +
            '"' +
            checked +
            "><span><strong>" +
            choice.id +
            "</strong>　" +
            esc(choice.text) +
            "</span></label></li>"
          );
        })
        .join("") +
      "</ul>"
    );
  }
  if (question.type === "numeric") {
    const options = question.units
      .map((unit) => {
        const selected = (draft.unit || question.units[0]) === unit ? " selected" : "";
        return '<option value="' + esc(unit) + '"' + selected + ">" + esc(unit) + "</option>";
      })
      .join("");
    return (
      '<label class="field"><span>數值</span><input name="value" inputmode="decimal" autocomplete="off" value="' +
      esc(draft.value || "") +
      '" placeholder="900 或 9.00×10^2"></label>' +
      '<label class="field"><span>單位</span><select name="unit">' +
      options +
      "</select></label>"
    );
  }
  return (
    '<label class="field"><span>解釋</span><textarea name="text" placeholder="' +
    esc(question.placeholder) +
    '">' +
    esc(draft.text || "") +
    "</textarea></label>"
  );
}

function renderResult(question) {
  const result = state.lastResult;
  if (!result || result.questionId !== question.id) return "";
  const graded = result.graded;
  const points = graded.points
    ? '<ul class="points">' +
      graded.points
        .map(
          (point) =>
            "<li><span class=\"" +
            (point.hit ? "got" : "miss") +
            '">' +
            (point.hit ? "得到" : "未得") +
            "</span><span>" +
            esc(point.text) +
            "</span></li>"
        )
        .join("") +
      "</ul>"
    : "";
  const steps = graded.steps
    ? '<ol class="steps">' + graded.steps.map((step) => "<li>" + esc(step) + "</li>").join("") + "</ol>"
    : "";
  const quote = graded.answerText
    ? '<blockquote class="quote">' + esc(graded.answerText) + "</blockquote>"
    : "";
  const book =
    graded.earned === graded.marks
      ? "錯題本：這題現為已掌握。"
      : "錯題本已收下這題。";
  return (
    '<section class="result" id="result"><div class="result-score"><b>' +
    graded.earned +
    "<small>/" +
    graded.marks +
    "</small></b><h3>" +
    esc(graded.headline) +
    "</h3></div><p class=\"detail\">" +
    esc(graded.detail) +
    "</p>" +
    quote +
    points +
    steps +
    '<p class="note">記入「' +
    esc(result.kpName) +
    "」。得分率 " +
    result.before +
    "% → " +
    result.after +
    "%，累計 " +
    result.n +
    " 次。" +
    book +
    "</p></section>"
  );
}

function renderMistakes(filter) {
  const labels = { retry: "待重做", again: "重做仍錯", mastered: "已掌握" };
  const items = state.mistakes.filter((item) => {
    if (filter === "open") return item.status !== "mastered";
    if (filter === "mastered") return item.status === "mastered";
    return true;
  });
  const filters =
    '<nav class="filters">' +
    filterLink("all", "全部", filter) +
    filterLink("open", "未掌握", filter) +
    filterLink("mastered", "已掌握", filter) +
    "</nav>";
  const rows = items.length
    ? items
        .map((item) => {
          const found = findKp(item.kpId);
          const redo = item.questionId
            ? '<a class="redo" href="#/practice/' + item.questionId + '">重做這題</a>'
            : "<span></span>";
          return (
            '<article class="mistake"><p class="status ' +
            item.status +
            '">' +
            labels[item.status] +
            '</p><div><h2>' +
            esc(item.title) +
            '</h2><p>' +
            esc(found.chapter.name) +
            " · " +
            esc(found.kp.name) +
            " · " +
            esc(item.type) +
            " · " +
            esc(item.score) +
            " · " +
            esc(item.when) +
            "</p><p>" +
            esc(item.reason) +
            "</p></div>" +
            redo +
            "</article>"
          );
        })
        .join("")
    : '<p class="empty">這個篩選下面沒有題目。</p>';
  return (
    '<div class="wrap"><p class="kicker">未拿滿分的題留在這裡</p><h1>錯題本</h1>' +
    '<p class="lede">第一次未滿分是待重做；再做仍未滿分是重做仍錯；之後有一次滿分就改為已掌握，紀錄仍保留。</p>' +
    filters +
    rows +
    '<p class="note">有「重做這題」的是示範題庫裡可作答的題。其餘是錯題本的紀錄樣式，題幹在正式題庫。</p></div>'
  );
}

function filterLink(id, label, current) {
  const on = id === current ? ' aria-current="page"' : "";
  return '<a href="#/mistakes/' + id + '"' + on + ">" + label + "</a>";
}

function renderClass() {
  const cover = coverage("class");
  const weak = weakPoints("class").slice(0, 8);
  const rows = this.CHAPTERS.map((chapter) => {
    const stats = summarize(allPoints(chapter), "class");
    const width = stats.mastery == null ? 0 : Math.round(stats.mastery);
    return (
      '<div class="kp"><span class="kp-name">' +
      esc(chapter.name) +
      " · " +
      chapter.hours +
      ' 小時</span><span class="band ' +
      bandForScore(stats.mastery).key +
      '">' +
      bandForScore(stats.mastery).label +
      '</span><span class="bar"><span style="width:' +
      width +
      "%;background:" +
      chapter.color +
      '"></span></span><span class="pct">' +
      pctText(stats.mastery) +
      '<small>%</small></span><span class="tries">' +
      stats.started +
      "/" +
      stats.total +
      "</span></div>"
    );
  }).join("");
  const weakRows = weak
    .map((item) => {
      return (
        "<li><span>" +
        esc(item.kp.name) +
        '</span><span class="where">' +
        esc(item.chapter.name) +
        '</span><span class="pct">' +
        Math.round(item.score) +
        "<small>%</small></span></li>"
      );
    })
    .join("");
  return (
    '<div class="wrap"><p class="kicker">示範班 · 28 人</p><h1>班別</h1>' +
    '<p class="lede">看課題和知識點的班平均，不排學生名次。個人頁用同一份知識點。這裡的數字是示例。</p>' +
    '<ul class="stats"><li class="stat"><b>' +
    pctText(overall("class")) +
    '%</b><span>班整體，按時數加權</span></li><li class="stat"><b>' +
    weakPoints("class").length +
    '</b><span>班上初學知識點</span></li><li class="stat"><b>' +
    cover.started +
    "/" +
    cover.total +
    '</b><span>已有作答的知識點</span></li></ul>' +
    '<h2 class="group-label">五個課題</h2><div class="class-table">' +
    rows +
    '</div><h2 class="group-label">最低的八個知識點</h2><ul class="weak-list">' +
    weakRows +
    '</ul><p class="note">下一課可以從這份清單裡還沒教穩的知識點選。高壓輸電、噪音、核裂變和質能關係在示例裡尚未開課，所以不出現在最低分，只算進覆蓋。</p></div>'
  );
}

function renderSettings() {
  const status = {
    checking: "正在檢查批改服務。",
    ready: "已接上。學生交結構題時，由伺服器上的 DeepSeek 批改。",
    missing: "服務有回應，但伺服器尚未放入金鑰。結構題暫時用要點對照。",
    down: "還連不到批改服務。結構題暫時用要點對照。",
  };
  return (
    '<div class="wrap"><p class="kicker">結構題</p><h1>批改服務</h1>' +
    '<p class="lede">學生直接做題，不必持有金鑰，也無法在頁面裡看到金鑰。瀏覽器只把答案送到我們的批改服務，服務再用放在伺服器上的 DeepSeek 金鑰去批改。</p>' +
    '<p class="note">把金鑰加密後放進網頁做不到這件事。瀏覽器若自己持有金鑰，原始碼和網絡請求裡就看得到。金鑰只放在 Supabase 的環境變數 DEEPSEEK_API_KEY。</p>' +
    '<p class="grader-note">' +
    esc(status[state.gradeService] || status.down) +
    '</p><div class="actions"><button class="btn" type="button" data-act="check-service">重新檢查</button></div></div>'
  );
}

function onMainClick(event) {
  const sort = event.target.closest("[data-sort]");
  if (sort) {
    state.homeSort = sort.dataset.sort;
    render();
    return;
  }
  const act = event.target.closest("[data-act]");
  if (!act) return;
  if (act.dataset.act === "check-service") refreshGradeService();
}

function onInput(event) {
  const form = event.target.form;
  if (!form || !form.dataset.qid) return;
  const draft = state.drafts[form.dataset.qid] || {};
  const name = event.target.name;
  if (name === "value" || name === "unit" || name === "text" || name === "choice") {
    draft[name] = event.target.value;
  }
  state.drafts[form.dataset.qid] = draft;
}

function finishGrade(question, graded) {
  state.grading = false;
  state.formError = "";
  const found = findKp(question.kpId);
  const before = found.kp.score == null ? "—" : String(found.kp.score);
  recordAttempt(found.kp, graded.earned / graded.marks);
  syncMistake(question, graded);
  state.lastResult = {
    questionId: question.id,
    graded,
    kpName: found.kp.name,
    before,
    after: found.kp.score,
    n: found.kp.n,
  };
  render();
  const result = document.querySelector("#result");
  if (result) result.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function onSubmit(event) {
  const form = event.target;
  if (!form.dataset || !form.dataset.qid) return;
  event.preventDefault();
  if (state.grading) return;
  const question = questionById(form.dataset.qid);
  const data = new FormData(form);
  const response = {
    choice: data.get("choice") || "",
    value: data.get("value") || "",
    unit: data.get("unit") || "",
    text: data.get("text") || "",
  };
  state.drafts[question.id] = response;
  if (question.type === "structured" && deepseekReady()) {
    const draft = String(response.text || "").trim();
    if (!draft) {
      state.formError = "請先寫下解釋。";
      state.lastResult = null;
      render();
      return;
    }
    state.formError = "";
    state.grading = true;
    state.lastResult = null;
    render();
    try {
      const graded = await gradeWithDeepseek(question, draft);
      finishGrade(question, graded);
    } catch (err) {
      state.grading = false;
      if (err.fallback) {
        const local = gradeQuestion(question, response);
        if (!local.error) {
          local.detail = err.message + " " + local.detail;
          finishGrade(question, local);
          return;
        }
      }
      state.formError = err.message || "批改失敗。";
      render();
    }
    return;
  }
  const graded = gradeQuestion(question, response);
  if (graded.error) {
    state.formError = graded.error;
    state.lastResult = state.lastResult && state.lastResult.questionId === question.id ? null : state.lastResult;
    render();
    return;
  }
  finishGrade(question, graded);
}

document.addEventListener("DOMContentLoaded", () => {
  cloneData();
  const main = document.querySelector("#main");
  main.addEventListener("click", onMainClick);
  main.addEventListener("input", onInput);
  main.addEventListener("change", onInput);
  main.addEventListener("submit", onSubmit);
  document.querySelector("#reset").addEventListener("click", () => {
    restoreData();
    location.hash = "#/";
    render();
  });
  window.addEventListener("hashchange", () => {
    state.formError = "";
    render();
  });
  if (!location.hash) location.hash = "#/";
  render();
  refreshGradeService();
});
