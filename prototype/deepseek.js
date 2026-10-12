var GRADE_ENDPOINT = "https://inwrpyaaryzkkruzcbgm.supabase.co/functions/v1/grade-physics";

function gradeAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (typeof SUPABASE_ANON_KEY === "string" && SUPABASE_ANON_KEY) {
    headers.Authorization = "Bearer " + SUPABASE_ANON_KEY;
    headers.apikey = SUPABASE_ANON_KEY;
  }
  return headers;
}

function deepseekReady() {
  return typeof state !== "undefined" && state.gradeService === "ready";
}

function parseModelJson(content) {
  const trimmed = String(content || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function asHit(value) {
  if (value === true || value === 1) return true;
  if (typeof value === "string") return /^(true|yes|y|得到|是)$/i.test(value.trim());
  return false;
}

function interpretDeepseekGrade(question, answerText, content) {
  let parsed;
  try {
    parsed = parseModelJson(content);
  } catch (err) {
    return { error: "批改沒有交回可用的評分，請再交一次。" };
  }
  const returned = Array.isArray(parsed.points) ? parsed.points : [];
  const points = question.points.map((point) => {
    const match = returned.find((item) => item && (item.id === point.id || item.text === point.text));
    return {
      id: point.id,
      text: point.text,
      marks: point.marks,
      hit: match ? asHit(match.hit) : false,
    };
  });
  const earned = points.reduce((sum, point) => sum + (point.hit ? point.marks : 0), 0);
  const missed = points.filter((point) => !point.hit).map((point) => point.text);
  let detail = String(parsed.detail || "").trim();
  if (!detail) {
    detail = missed.length ? "還差：" + missed.join("；") + "。" : "評分準則裡的要點都達到了。";
  }
  if (earned < question.marks && question.model) detail += " 參考講法：" + question.model;
  let reason = String(parsed.reason || "").trim();
  if (!reason) reason = earned === question.marks ? "最近一次已拿滿分" : missed.length ? "未寫到：" + missed.join("、") : "未拿滿分";
  if (reason.length > 80) reason = reason.slice(0, 80);
  return {
    earned: earned,
    marks: question.marks,
    headline: earned === question.marks ? "要點都有" : "給了 " + earned + " 分",
    detail: detail,
    reason: reason,
    points: points,
    steps: null,
    answerText: answerText,
    source: "deepseek",
  };
}

async function refreshGradeService() {
  state.gradeService = "checking";
  try {
    const response = await fetch(GRADE_ENDPOINT, {
      method: "POST",
      headers: gradeAuthHeaders(),
      body: JSON.stringify({ ping: true }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.configured) state.gradeService = "ready";
    else if (response.ok && data.configured === false) state.gradeService = "missing";
    else state.gradeService = "down";
  } catch (err) {
    state.gradeService = "down";
  }
  render();
}

async function gradeWithDeepseek(question, answerText) {
  const scheme = question.points.map((point) => ({
    id: point.id,
    marks: point.marks,
    text: point.text,
  }));
  let response;
  try {
    response = await fetch(GRADE_ENDPOINT, {
      method: "POST",
      headers: gradeAuthHeaders(),
      body: JSON.stringify({
        stem: question.stem,
        scheme: scheme,
        reference: question.model || "",
        answer: answerText,
      }),
    });
  } catch (err) {
    throw new Error("連不到批改服務。");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "批改服務暫時無法使用。");
    error.fallback = Boolean(data.fallback);
    throw error;
  }
  const graded = interpretDeepseekGrade(question, answerText, data.content);
  if (graded.error) throw new Error(graded.error);
  return graded;
}
