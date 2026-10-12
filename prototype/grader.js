function parseNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  s = s.replace(/．/g, ".");
  s = s.replace(/\s+/g, "").replace(/,/g, "").replace(/，/g, "");
  s = s.replace(/[×xX＊*]/g, "x");
  const sup = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
    "⁻": "-",
    "−": "-",
  };
  s = s.replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻−]+)/g, (_, exp) => {
    return "10^" + Array.from(exp, (ch) => sup[ch] || ch).join("");
  });
  s = s.replace(/−/g, "-");
  const sci = s.match(/^([+-]?\d+(?:\.\d+)?)(?:x10\^|e)([+-]?\d+)$/i);
  if (sci) {
    const n = Number(sci[1]) * 10 ** Number(sci[2]);
    return Number.isFinite(n) ? n : null;
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function near(n, target, tolerance) {
  const rel = tolerance == null ? 0.02 : tolerance;
  const tol = Math.max(Math.abs(target) * rel, 0.51);
  return Math.abs(n - target) <= tol;
}

function compact(text) {
  return String(text || "").replace(/\s+/g, "");
}

function hitFastMolecules(text) {
  const c = compact(text);
  if (
    /動能較高|較高的動能|較高動能|高動能|動能較大|較大的動能|較快的分子|速度快的分子|高速分子|能量較高的分子|能量高的分子|高能量的分子|分子動能較高|動能高的分子/.test(
      c
    )
  ) {
    return true;
  }
  return /分子|粒子/.test(c) && /動能/.test(c) && /高|大|快/.test(c) && /離開|逸出|走|脫離|蒸發/.test(c);
}

function hitRemaining(text) {
  const c = compact(text);
  if (!/留下|餘下|剩餘|剩下|留低/.test(c)) return false;
  return /平均動能|動能|平均能量/.test(c);
}

function hitTemperature(text) {
  const c = compact(text);
  if (!/溫度/.test(c) || !/下降|降低|變低|下跌|較低|變冷|變涼|感到涼/.test(c)) return false;
  return /平均動能|平均能量|動能/.test(c);
}

const STRUCTURED_TESTS = {
  fast: hitFastMolecules,
  remain: hitRemaining,
  temp: hitTemperature,
};

function gradeQuestion(question, response) {
  if (question.type === "mc") return gradeMc(question, response);
  if (question.type === "numeric") return gradeNumeric(question, response);
  if (question.type === "structured") return gradeStructured(question, response);
  return { error: "這題型尚未接上批改。" };
}

function gradeMc(question, response) {
  const choice = response && response.choice;
  if (!choice) return { error: "請先選一項。" };
  const correct = choice === question.answer;
  const note = question.notes[choice] || "";
  const right = question.choices.find((item) => item.id === question.answer);
  return {
    earned: correct ? question.marks : 0,
    marks: question.marks,
    headline: correct ? "選對了" : "這項不是波義耳定律",
    detail: correct
      ? question.notes[question.answer]
      : note + " 正確是 " + question.answer + "：" + right.text + "。" + question.notes[question.answer],
    reason: correct ? "最近一次已拿滿分" : question.notes[choice],
    points: null,
    steps: null,
  };
}

function gradeNumeric(question, response) {
  const raw = response && response.value;
  const n = parseNumber(raw);
  if (n == null) return { error: "請輸入數值，例如 900 或 9.00×10^2。" };
  const unit = response.unit;
  const unitOk = unit === question.answer.unit;
  if (near(n, question.answer.value, question.answer.tolerance)) {
    if (unitOk) {
      return {
        earned: question.marks,
        marks: question.marks,
        headline: "數值和單位都對",
        detail: "c = Q / (m ΔT) = 9.00 × 10² J kg⁻¹ °C⁻¹。",
        reason: "最近一次已拿滿分",
        points: null,
        steps: question.steps,
      };
    }
    return {
      earned: 2,
      marks: question.marks,
      headline: "數值正確，單位不對",
      detail:
        "9.00 × 10² 這個數是對的。比熱容量的單位是 J kg⁻¹ °C⁻¹，要同時對應質量和溫差。你選的是「" +
        unit +
        "」。",
      reason: "數值正確，單位不是 J kg⁻¹ °C⁻¹",
      points: null,
      steps: question.steps,
    };
  }
  const matched = (question.commonErrors || []).find((item) => near(n, item.value, item.tolerance));
  if (matched) {
    return {
      earned: matched.marks,
      marks: question.marks,
      headline: matched.headline,
      detail: matched.detail,
      reason: matched.headline,
      points: null,
      steps: question.steps,
    };
  }
  return {
    earned: 0,
    marks: question.marks,
    headline: "數值對不上",
    detail: "標準答案是 9.00 × 10² J kg⁻¹ °C⁻¹。下面是計算步驟。",
    reason: "最終數值與比熱容量不符",
    points: null,
    steps: question.steps,
  };
}

function gradeStructured(question, response) {
  const text = (response && response.text ? String(response.text) : "").trim();
  if (!text) return { error: "請先寫下解釋。" };
  const points = question.points.map((point) => {
    const test = STRUCTURED_TESTS[point.id];
    return {
      id: point.id,
      text: point.text,
      marks: point.marks,
      hit: test ? test(text) : false,
    };
  });
  const earned = points.reduce((sum, point) => sum + (point.hit ? point.marks : 0), 0);
  const missed = points.filter((point) => !point.hit).map((point) => point.text);
  let detail;
  if (earned === question.marks) {
    detail = "三個要點都寫到了。" + question.model;
  } else if (missed.length) {
    detail = "還差：" + missed.join("；") + "。參考講法：" + question.model;
  } else {
    detail = question.model;
  }
  return {
    earned,
    marks: question.marks,
    headline: earned === question.marks ? "三個要點都有" : "按評分準則給了 " + earned + " 分",
    detail,
    reason: earned === question.marks ? "最近一次已拿滿分" : missed.length ? "未寫到：" + missed.join("、") : "未拿滿分",
    points,
    steps: null,
    answerText: text,
  };
}
