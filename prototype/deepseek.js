var DEEPSEEK_STORAGE = "funlearning-deepseek-key";
var DEEPSEEK_MODEL = "deepseek-flash";
var DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

function deepseekKey() {
  try {
    return (localStorage.getItem(DEEPSEEK_STORAGE) || "").trim();
  } catch (err) {
    return "";
  }
}

function deepseekReady() {
  return deepseekKey().length > 10;
}

function saveDeepseekKey(value) {
  const key = String(value || "").trim();
  if (!key) localStorage.removeItem(DEEPSEEK_STORAGE);
  else localStorage.setItem(DEEPSEEK_STORAGE, key);
}

function clearDeepseekKey() {
  localStorage.removeItem(DEEPSEEK_STORAGE);
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
    return { error: "DeepSeek 沒有交回可用的評分，請再交一次。" };
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
    headline: earned === question.marks ? "DeepSeek：要點都有" : "DeepSeek 給了 " + earned + " 分",
    detail: detail,
    reason: reason,
    points: points,
    steps: null,
    answerText: answerText,
    source: "deepseek",
  };
}

function deepseekError(status, bodyText) {
  if (status === 401) return "金鑰被拒絕。到 DeepSeek 頁檢查這把金鑰。";
  if (status === 402) return "DeepSeek 餘額不足。";
  if (status === 429) return "DeepSeek 暫時太忙，稍後再交。";
  return "DeepSeek 回覆 " + status + "。" + (bodyText ? " " + String(bodyText).slice(0, 140) : "");
}

async function callDeepseek(key, payload) {
  let response;
  try {
    response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error("連不到 DeepSeek。檢查網絡後再試。");
  }
  const raw = await response.text();
  if (!response.ok) throw new Error(deepseekError(response.status, raw));
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error("DeepSeek 回覆無法讀取。");
  }
  const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) throw new Error("DeepSeek 沒有給出評分，請再交一次。");
  return content;
}

async function gradeWithDeepseek(question, answerText) {
  const scheme = question.points.map((point) => ({
    id: point.id,
    marks: point.marks,
    text: point.text,
  }));
  const content = await callDeepseek(deepseekKey(), {
    model: DEEPSEEK_MODEL,
    thinking: { type: "disabled" },
    response_format: { type: "json_object" },
    max_tokens: 800,
    messages: [
      {
        role: "system",
        content:
          "你是香港高中物理教師。按評分準則批改學生答案。意思相同就算該點得到，不必和參考講法逐字相同。不要自加準則以外的扣分。只回覆 json，格式是 {\"points\":[{\"id\":\"準則id\",\"hit\":true}],\"detail\":\"給學生的訂正，繁體中文\",\"reason\":\"二十字以內的錯因\"}。",
      },
      {
        role: "user",
        content: JSON.stringify({
          stem: question.stem,
          scheme: scheme,
          reference: question.model || "",
          answer: answerText,
        }),
      },
    ],
  });
  const graded = interpretDeepseekGrade(question, answerText, content);
  if (graded.error) throw new Error(graded.error);
  return graded;
}

async function pingDeepseek(key) {
  await callDeepseek(key, {
    model: DEEPSEEK_MODEL,
    thinking: { type: "disabled" },
    max_tokens: 16,
    messages: [{ role: "user", content: "只回覆 ok" }],
  });
}
