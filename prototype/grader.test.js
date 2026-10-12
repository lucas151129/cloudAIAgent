const fs = require("fs");
const vm = require("vm");
const path = require("path");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "grader.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "deepseek.js"), "utf8"), context);

const { QUESTIONS, CHAPTERS, parseNumber, gradeQuestion, interpretDeepseekGrade } = context;
const q = Object.fromEntries(QUESTIONS.map((item) => [item.id, item]));

function assert(name, condition) {
  if (!condition) {
    console.error("FAIL", name);
    process.exitCode = 1;
  } else {
    console.log("ok", name);
  }
}

assert("parse 900", parseNumber("900") === 900);
assert("parse scientific", parseNumber("9.00×10^2") === 900);
assert("parse superscript", parseNumber("5.40×10⁴") === 54000);
assert("parse fullwidth", parseNumber("９００") === 900);
assert("parse reject unit glued", parseNumber("900J") === null);

const boyleRight = gradeQuestion(q["q-boyle"], { choice: "B" });
assert("boyle right", boyleRight.earned === 1 && !boyleRight.error);
const boyleWrong = gradeQuestion(q["q-boyle"], { choice: "C" });
assert("boyle wrong", boyleWrong.earned === 0 && boyleWrong.detail.includes("開氏"));
assert("boyle empty", gradeQuestion(q["q-boyle"], {}).error);

const heatRight = gradeQuestion(q["q-specific"], { value: "9.00×10^2", unit: "J kg⁻¹ °C⁻¹" });
assert("specific heat full", heatRight.earned === 3);
const heatUnit = gradeQuestion(q["q-specific"], { value: "900", unit: "J" });
assert("specific heat unit", heatUnit.earned === 2 && heatUnit.headline.includes("單位"));
const heatQm = gradeQuestion(q["q-specific"], { value: "54000", unit: "J kg⁻¹ °C⁻¹" });
assert("specific heat Q/m", heatQm.earned === 1 && heatQm.headline.includes("溫差"));
const heatC = gradeQuestion(q["q-specific"], { value: "450", unit: "J °C⁻¹" });
assert("specific heat capacity C", heatC.earned === 1 && heatC.detail.includes("熱容量"));
const heatT = gradeQuestion(q["q-specific"], { value: "675", unit: "J kg⁻¹ °C⁻¹" });
assert("specific heat used final T", heatT.earned === 1);
const heatBad = gradeQuestion(q["q-specific"], { value: "123", unit: "J kg⁻¹ °C⁻¹" });
assert("specific heat unknown", heatBad.earned === 0 && heatBad.steps.length === 3);

const full =
  "蒸發時，動能較高的分子離開液面。留下的分子平均動能下降，所以溫度下降。";
const fullGrade = gradeQuestion(q["q-evap"], { text: full });
assert("evap full", fullGrade.earned === 3 && fullGrade.points.every((point) => point.hit));

const partial = "溫度下降是因為留下的分子動能低。";
const partialGrade = gradeQuestion(q["q-evap"], { text: partial });
assert(
  "evap partial",
  partialGrade.earned === 2 &&
    partialGrade.points.find((point) => point.id === "fast").hit === false
);

const vague = "因為水蒸發帶走熱，所以變涼。";
assert("evap vague", gradeQuestion(q["q-evap"], { text: vague }).earned === 0);
assert("evap empty", gradeQuestion(q["q-evap"], { text: "  " }).error);

const paraphrase = "能量高的分子走了，剩下的分子平均動能變低，溫度就下降。";
assert("evap paraphrase", gradeQuestion(q["q-evap"], { text: paraphrase }).earned === 3);

const evap = q["q-evap"];
const fromModel = interpretDeepseekGrade(
  evap,
  "水變涼",
  JSON.stringify({
    points: [
      { id: "fast", hit: true },
      { id: "remain", hit: false },
      { id: "temp", hit: "得到" },
    ],
    detail: "提到分子離開，也提到溫度。",
    reason: "未寫留下的分子",
  })
);
assert("deepseek marks", fromModel.earned === 2 && fromModel.source === "deepseek");
assert("deepseek miss remain", fromModel.points.find((point) => point.id === "remain").hit === false);
assert(
  "deepseek fenced",
  interpretDeepseekGrade(evap, "x", "```json\n{\"points\":[]}\n```").earned === 0
);
assert("deepseek bad json", interpretDeepseekGrade(evap, "x", "不是 json").error);
const clientSource = fs.readFileSync(path.join(__dirname, "deepseek.js"), "utf8");
assert("client does not call DeepSeek", !clientSource.includes("api.deepseek.com"));
assert("client does not store a key", !clientSource.includes("localStorage"));
const proxySource = fs.readFileSync(path.join(__dirname, "../supabase/functions/grade-physics/index.ts"), "utf8");
assert("proxy reads server secret", proxySource.includes('Deno.env.get("DEEPSEEK_API_KEY")'));
assert("proxy has no pasted key", !/sk-[A-Za-z0-9]{8,}/.test(proxySource));

let points = 0;
for (const chapter of CHAPTERS) {
  for (const group of chapter.groups) points += group.points.length;
}
assert("79 knowledge points", points === 79);
const hours = CHAPTERS.reduce((sum, chapter) => sum + chapter.hours, 0);
assert("184 hours", hours === 184);

function mastery(chapter) {
  const all = chapter.groups.flatMap((group) => group.points).filter((kp) => kp.score != null);
  return all.reduce((sum, kp) => sum + kp.score, 0) / all.length;
}
let weighted = 0;
for (const chapter of CHAPTERS) weighted += mastery(chapter) * chapter.hours;
console.log("overall", Math.round(weighted / hours));
for (const chapter of CHAPTERS) {
  console.log(chapter.id, Math.round(mastery(chapter)));
}
