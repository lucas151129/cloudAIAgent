/* 加自己的 HTML 遊戲：
   1. 把檔案放到 games/你的資料夾/index.html
   2. 在下面的 GAMES 加一筆，entry 指向那個檔案，maxScore 填這款遊戲的滿分，icon 指向這款遊戲自己的圖示。就算這個科目只有一款遊戲，也要單獨做一張圖示，不要沿用科目圖示。
   3. 遊戲結束時送出分數（分數用這款遊戲自己的計分，不要先換算）：
      parent.postMessage({ type: "game-score", score: 分數 }, location.origin);
   平台會用「分數 / 滿分 × 100」換成百分，再加進總排行榜。
   若填了 questions，平台會用內建問答頁，不必另寫 HTML。
*/
const CATEGORIES = [
  { id: "chinese", name: "中文", icon: "assets/chinese.png" },
  { id: "english", name: "英文", icon: "assets/english.png" },
  { id: "math", name: "數學", icon: "assets/math.png" },
  { id: "physics", name: "物理", icon: "assets/physics.png" },
  { id: "chemistry", name: "化學", icon: "assets/chemistry.png" },
  { id: "biology", name: "生物", icon: "assets/biology.png" },
  { id: "science", name: "科學", icon: "assets/science.png" },
];

const GAMES = [
  {
    id: "zh-ink",
    category: "chinese",
    title: "水墨之舟",
    level: "upper",
    blurb: "乘著水墨小舟，辨認句子裡的修辭手法。",
    maxScore: 200,
    icon: "assets/games/zh-ink.png?v=1",
    entry: "games/chinese/ink-boat/index.html",
  },
  {
    id: "en-candy",
    category: "english",
    title: "字母糖果倉庫",
    level: "lower",
    blurb: "把字母糖果推進倉庫，拼出英文單字。",
    maxScore: 3000,
    icon: "assets/games/en-candy.png?v=1",
    entry: "games/english/candy-warehouse/index.html",
  },
  {
    id: "phy-rocket",
    category: "physics",
    title: "水火箭",
    level: "upper",
    blurb: "調整角度和水量，讓水火箭落到目標。",
    maxScore: 2000,
    icon: "assets/games/phy-rocket.png?v=1",
    entry: "games/physics/water-rocket/index.html",
  },
  {
    id: "chem-cauldron",
    category: "chemistry",
    title: "化學反應釜",
    level: "upper",
    blurb: "在反應釜裡算出精確答案，答得越快獎勵越高。",
    maxScore: 1500,
    icon: "assets/games/chem-cauldron.png?v=1",
    entry: "games/chemistry/cauldron/index.html",
  },
  {
    id: "chem-balance",
    category: "chemistry",
    title: "方程式配平",
    level: "upper",
    blurb: "移動平衡，看反應怎麼跟著改變。",
    maxScore: 500,
    icon: "assets/games/chem-balance.png?v=1",
    entry: "games/chemistry/balance/index.html",
  },
  {
    id: "chem-bubbles",
    category: "chemistry",
    title: "化學泡泡龍",
    level: "middle",
    blurb: "把離子泡泡配成化合物。",
    maxScore: 3000,
    icon: "assets/games/chem-bubbles.png?v=1",
    entry: "games/chemistry/bubbles/index.html",
  },
  {
    id: "math-coin",
    category: "math",
    title: "數學推幣機",
    level: "middle",
    blurb: "答對題目，把金幣推進來。累計獲得 300 金幣就是滿分。",
    maxScore: 300,
    icon: "assets/games/math-coin.png?v=1",
    entry: "games/math/coin-pusher/index.html",
  },
  {
    id: "math-snake",
    category: "math",
    title: "正負數貪食蛇",
    level: "upper",
    blurb: "判斷運算符號，讓蛇吃到正確的數。",
    maxScore: 1000,
    icon: "assets/games/math-snake.png?v=1",
    entry: "games/math/snake/index.html",
  },
  {
    id: "math-thunder",
    category: "math",
    title: "雷霆算式",
    level: "upper",
    blurb: "用手牌組出算式，擊破敵機。累計 800 零件就是滿分。",
    maxScore: 800,
    icon: "assets/games/math-thunder.png?v=1",
    entry: "games/math/thunder/index.html",
  },
  {
    id: "math-fish",
    category: "math",
    title: "狂爆金幣",
    level: "middle",
    blurb: "一邊捕魚一邊算數學。累計 2000 金幣就是滿分。",
    maxScore: 2000,
    icon: "assets/games/math-fish.png?v=1",
    entry: "games/math/fish/index.html",
  },
  {
    id: "sci-garden",
    category: "science",
    title: "太空菜園",
    level: "middle",
    blurb: "在太空種植箱裡做公平測試，種出一株太空蕓豆。",
    maxScore: 600,
    icon: "assets/games/sci-garden.png?v=1",
    entry: "games/science/space-garden/index.html",
  },
  {
    id: "sci-strong",
    category: "science",
    title: "誰是大力士",
    level: "lower",
    blurb: "用紙柱做實驗，找出哪一種形狀最能承托重量。",
    maxScore: 460,
    icon: "assets/games/sci-strong.png?v=1",
    entry: "games/science/strongman/index.html",
  },
  {
    id: "sci-maglev",
    category: "science",
    title: "磁浮小勇士",
    level: "middle",
    blurb: "用磁極和摩擦力，讓磁浮列車浮起來並跑得更快。",
    maxScore: 2000,
    icon: "assets/games/sci-maglev.png?v=1",
    entry: "games/science/maglev/index.html",
  },
  {
    id: "sci-air",
    category: "science",
    title: "空氣炮小科學家",
    level: "lower",
    blurb: "做出空氣炮，探究看不見的氣流怎麼吹熄蠟燭。",
    maxScore: 1200,
    icon: "assets/games/sci-air.png?v=1",
    entry: "games/science/air-cannon/index.html",
  },
  {
    id: "sci-trebuchet",
    category: "science",
    title: "霹靂車工程師",
    level: "upper",
    blurb: "設計投石器，用實驗把石頭投得更遠。",
    maxScore: 100,
    icon: "assets/games/sci-trebuchet.png?v=1",
    entry: "games/science/trebuchet/index.html",
  },
  {
    id: "sci-ice",
    category: "science",
    title: "冰城挑戰",
    level: "middle",
    blurb: "設計防寒服，用公平測試比較保暖物料。",
    maxScore: 1900,
    icon: "assets/games/sci-ice.png?v=1",
    entry: "games/science/ice-city/index.html",
  },
];

function categoryById(id) {
  return CATEGORIES.find((item) => item.id === id) || null;
}

function gameById(id) {
  return GAMES.find((item) => item.id === id) || null;
}

function gamesIn(categoryId) {
  return GAMES.filter((item) => item.category === categoryId);
}

function gameMax(game) {
  if (game.questions && game.questions.length) return game.questions.length;
  return game.maxScore;
}
