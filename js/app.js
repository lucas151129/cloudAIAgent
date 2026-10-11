const app = document.querySelector("#app");
const accountSlot = document.querySelector("#account");
const toast = document.querySelector("#toast");
let openGameId = null;
let toastTimer = 0;

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function iconBack() {
  return `<svg class="ico" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path d="M11 2 L5 8 L11 14" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="miter" stroke-linecap="square"/></svg>`;
}

function iconTrophy() {
  return `<span class="ico-star" aria-hidden="true">★</span>`;
}

function tf(key, vars) {
  return I18n.tf(key, vars);
}

function catName(cat) {
  return cat ? I18n.t("cat." + cat.id) : I18n.t("nav.back");
}

function gameText(game, field) {
  const key = "game." + game.id + "." + field;
  const value = I18n.t(key);
  return value === key ? game[field] : value;
}

function levelText(level) {
  const key = "level." + level;
  const value = I18n.t(key);
  return value === key ? level : value;
}

const STAR_PATH = "M12 1.6 14.9 8.2 22 8.8 16.6 13.5 18.3 20.4 12 16.8 5.7 20.4 7.4 13.5 2 8.8 9.1 8.2 Z";

function starGlyph() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
}

function starLabel(stars) {
  return Number(stars) === 1 ? I18n.t("rate.starOne") : tf("rate.star", { stars });
}

function displayStars(value) {
  return Math.round(Number(value) * 2) / 2;
}

function formatStars(stars) {
  const value = Number(stars);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatAvg(value) {
  return (Math.round(Number(value) * 10) / 10).toFixed(1);
}

function starsHtml(value, interactive) {
  const current = Number(value) || 0;
  return [1, 2, 3, 4, 5].map((index) => {
    const kind = current >= index ? "full" : current >= index - 0.5 ? "half" : "empty";
    const hits = interactive
      ? `<button type="button" class="star-hit left" data-rate="${index - 0.5}" aria-label="${esc(starLabel(index - 0.5))}" aria-pressed="${current === index - 0.5 ? "true" : "false"}"></button><button type="button" class="star-hit right" data-rate="${index}" aria-label="${esc(starLabel(index))}" aria-pressed="${current === index ? "true" : "false"}"></button>`
      : "";
    return `<span class="star ${kind}">${starGlyph()}${starGlyph()}${hits}</span>`;
  }).join("");
}

function rateSummaryText(summary) {
  if (!summary.count) return I18n.t("rate.none");
  const avg = formatAvg(summary.average);
  const key = I18n.lang === "en" && summary.count === 1 ? "rate.summaryOne" : "rate.summary";
  return tf(key, { avg, n: summary.count });
}

function rateMini(gameId) {
  const summary = Store.ratingOf(gameId);
  if (!summary.count) return "";
  return `<span class="rate-mini"><span class="stars" aria-hidden="true">${starsHtml(displayStars(summary.average), false)}</span><span>${esc(formatAvg(summary.average))}</span></span>`;
}

function paintStars(root, value) {
  if (!root) return;
  root.querySelectorAll(".star").forEach((star, index) => {
    const n = index + 1;
    star.classList.remove("full", "half", "empty");
    star.classList.add(value >= n ? "full" : value >= n - 0.5 ? "half" : "empty");
  });
}

function rateMarkup(game) {
  const summary = Store.ratingOf(game.id);
  const mine = Store.myRating(game.id);
  const user = Store.current();
  const played = Boolean(Store.myBest(game.id));
  const avgLabel = rateSummaryText(summary);
  let yours;
  if (!user) yours = `<p class="rate-lock">${esc(I18n.t("rate.needLogin"))}</p>`;
  else if (!played) yours = `<p class="rate-lock">${esc(I18n.t("rate.needPlay"))}</p>`;
  else {
    yours = `<div class="rate-pick" data-value="${mine || 0}">
      <p class="rate-label">${esc(I18n.t("rate.yours"))}</p>
      <div class="stars" role="group" aria-label="${esc(I18n.t("rate.yours"))}">${starsHtml(mine || 0, true)}</div>
      <p class="rate-hint">${esc(I18n.t("rate.hint"))}</p>
    </div>`;
  }
  return `<section class="rate-box" id="rate-box">
    <h2>${esc(I18n.t("rate.title"))}</h2>
    <div class="rate-avg">
      <div class="stars" role="img" aria-label="${esc(avgLabel)}">${starsHtml(summary.count ? displayStars(summary.average) : 0, false)}</div>
      <p>${esc(avgLabel)}</p>
    </div>
    ${yours}
  </section>`;
}

function topRated(limit) {
  return GAMES
    .map((game) => ({ game, ...Store.ratingOf(game.id) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.average - a.average || b.count - a.count)
    .slice(0, limit);
}

function renderPicks() {
  const top = topRated(3);
  const cards = top.length
    ? `<div class="pick-grid">${top.map((item, index) => {
      const cat = categoryById(item.game.category);
      return `<a class="pick-card" href="#/g/${item.game.id}">
        <span class="pick-rank">${index + 1}</span>
        <img src="${item.game.icon || (cat ? cat.icon : "")}" alt="">
        <span class="pick-copy">
          <strong>${esc(gameText(item.game, "title"))}</strong>
          <span class="pick-cat">${esc(catName(cat))}</span>
          ${rateMini(item.game.id)}
        </span>
      </a>`;
    }).join("")}</div>`
    : `<p class="picks-empty">${esc(I18n.t("home.picksEmpty"))}</p>`;
  return `<section class="picks">
    <h2>${esc(I18n.t("home.picks"))}</h2>
    <p>${esc(I18n.t("home.picksLead"))}</p>
    ${cards}
  </section>`;
}

function currentSize() {
  return document.documentElement.dataset.size === "desk" ? "desk" : "phone";
}

function applySize(size) {
  const next = size === "desk" ? "desk" : "phone";
  document.documentElement.dataset.size = next;
  localStorage.setItem("pixel-study-size", next);
}

function renderChrome() {
  document.documentElement.lang = I18n.lang;
  document.title = I18n.t("site.name");
  const brand = document.querySelector("[data-brand]");
  const tag = document.querySelector("[data-tag]");
  if (brand) brand.textContent = I18n.t("site.brand");
  if (tag) tag.textContent = I18n.t("site.tag");
  const skip = document.querySelector(".skip");
  if (skip) skip.textContent = I18n.t("skip");
  const board = document.querySelector("[data-nav-board]");
  if (board) board.textContent = I18n.t("nav.board");
  const langs = document.querySelector("#langs");
  if (langs) langs.setAttribute("aria-label", I18n.t("lang.label"));
  const sizes = document.querySelector("#sizes");
  if (sizes) sizes.setAttribute("aria-label", I18n.t("size.label"));
  document.querySelectorAll("[data-lang]").forEach((button) => {
    const on = button.dataset.lang === I18n.lang;
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelectorAll("#sizes button[data-size]").forEach((button) => {
    const on = button.dataset.size === currentSize();
    button.classList.toggle("on", on);
    button.textContent = I18n.t(button.dataset.size === "desk" ? "size.desk" : "size.phone");
    button.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function renderAccount() {
  const summary = Store.mySummary();
  if (!summary) {
    accountSlot.innerHTML = `
      <a class="btn btn-cream btn-small" href="#/login">${esc(I18n.t("nav.login"))}</a>
      <a class="btn btn-small" href="#/register">${esc(I18n.t("nav.register"))}</a>`;
    return;
  }
  accountSlot.innerHTML = `
    <span class="who">${esc(tf("who", { name: summary.username, points: summary.points }))}</span>
    <button class="btn btn-cream btn-small" type="button" data-logout>${esc(I18n.t("nav.logout"))}</button>`;
}

function boardRows(rows, mode, max) {
  if (!rows.length) {
    return `<div class="empty">
      <img src="assets/mascot.png?v=corgi" alt="">
      <p>${esc(I18n.t("empty.1"))}<br>${esc(I18n.t("empty.2"))}</p>
    </div>`;
  }
  const mine = Store.current();
  return `<ol class="board">
    ${rows.map((row, index) => {
      const gamesWord = I18n.lang === "en" && row.games === 1 ? "1 game" : null;
      const score = mode === "game"
        ? tf("score.game", { raw: row.raw, max, points: row.points })
        : gamesWord
          ? `${row.points} pts · ${gamesWord}`
          : tf("score.total", { points: row.points, games: row.games });
      const mineClass = mine && row.userId === mine.id ? " mine" : "";
      const name = row.username || I18n.t("unknown");
      return `<li class="rank-${index + 1}${mineClass}">
        <span class="rank">${index + 1}</span>
        ${avatarHtml(row.userId, name)}
        <span class="player">${esc(name)}</span>
        <span class="pts">${esc(score)}</span>
      </li>`;
    }).join("")}
  </ol>`;
}

const PET_STAGES = ["bubble", "baby", "grow", "adult", "scholar"];
const PET_SPECIES = ["tabby", "fluff", "dog", "husky", "golden", "shiba", "macaw", "bunny", "panda", "redpanda", "tortoise"];

function petSrc(species, stage) {
  const kind = PET_SPECIES.includes(species) ? species : "dog";
  const form = PET_STAGES[stage] || "bubble";
  return `assets/pets/${kind}/${form}.png?v=2`;
}

function avatarHtml(userId, name) {
  const pet = Store.petCard(userId);
  const label = tf("pet.avatar", { name });
  const face = pet
    ? `<img src="${petSrc(pet.species, pet.stage)}" alt="">`
    : `<span class="avatar-empty" aria-hidden="true"></span>`;
  return `<a class="avatar" href="#/u/${encodeURIComponent(userId)}" aria-label="${esc(label)}">${face}</a>`;
}

function renderPetChoice() {
  openGameId = null;
  const cards = PET_SPECIES.map((species) => `
    <button class="egg-card" type="button" data-pet="${species}">
      <img src="${petSrc(species, 0)}" alt="">
      <span>${esc(I18n.t("pet.pick." + species))}</span>
    </button>`).join("");
  app.innerHTML = `
    <section class="pet-room panel">
      <h1>${esc(I18n.t("pet.pick.title"))}</h1>
      <p>${esc(I18n.t("pet.pick.lead"))}</p>
      <div class="egg-list">${cards}</div>
    </section>`;
}

function renderPetPage() {
  openGameId = null;
  const pet = Store.petView();
  if (!pet || pet.needsChoice) {
    renderPetChoice();
    return;
  }
  const stageName = I18n.t("pet." + pet.id);
  const speciesName = I18n.t("pet.species." + pet.species);
  app.innerHTML = `
    <section class="pet-room panel">
      <h1>${esc(tf("pet.title", { species: speciesName }))}</h1>
      <p class="pet-stage">${esc(stageName)} · ${esc(tf("pet.xp", { n: pet.xp }))}</p>
      <div class="pet-bar" role="progressbar" aria-valuenow="${pet.xp}" aria-valuemin="0" aria-valuemax="${pet.next || pet.xp}" aria-label="${esc(stageName)}"><span style="width:${Math.max(0, Math.min(100, Math.round(pet.into * 100)))}%"></span></div>
      <p>${esc(pet.next == null ? I18n.t("pet.max") : tf("pet.next", { left: pet.next - pet.xp }))}</p>
      <p class="pet-today">${esc(tf("pet.today", { got: pet.dayXp, cap: pet.daily }))}</p>
      <p class="coin-line">${esc(tf("shop.coins", { n: pet.coins || 0 }))}</p>
      <div class="pet-stage-wrap">
        <img class="pet-still" src="${petSrc(pet.species, pet.stage)}" alt="${esc(speciesName)}">
      </div>
      <a class="btn btn-mint shop-open" href="#/shop">${esc(I18n.t("shop.open"))}</a>
      <a class="btn pet-go" href="#/c">${esc(I18n.t("pet.go"))}</a>
    </section>`;
}

function coinToast(pet) {
  if (!pet || !pet.ok) return "";
  if (pet.coinGain > 0) return " " + tf("shop.toast", { n: pet.coinGain });
  return " " + I18n.t("shop.toastFull");
}

function petToast(pet) {
  if (!pet || !pet.ok) return "";
  if (pet.evolved) return " " + tf("pet.toastEvolved", { stage: I18n.t("pet." + pet.id), n: pet.gain });
  if (pet.gain > 0) return " " + tf("pet.toast", { n: pet.gain, got: pet.dayXp, cap: pet.daily });
  return " " + I18n.t("pet.toastFull");
}

function catCards() {
  return CATEGORIES.map((cat) => {
    const count = gamesIn(cat.id).length;
    return `<a class="cat-card" href="#/c/${cat.id}">
      <img src="${cat.icon}" alt="">
      <span class="name">${esc(catName(cat))}</span>
      <span class="count">${esc(I18n.lang === "en" && count === 1 ? "1 game" : tf("count.games", { n: count }))}</span>
    </a>`;
  }).join("");
}

function miniRates() {
  const top = topRated(5);
  const rows = top.length
    ? `<ol class="mini-board">${top.map((item, index) => `<li>
        <span class="rank">${index + 1}</span>
        <a href="#/g/${item.game.id}">${esc(gameText(item.game, "title"))}</a>
        <span>${esc(formatAvg(item.average))}</span>
      </li>`).join("")}</ol>`
    : `<p>${esc(I18n.t("side.emptyRates"))}</p>`;
  return `<section class="panel side-card">
    <h2>${esc(I18n.t("side.rates"))}</h2>
    ${rows}
    <a class="btn btn-cream" href="#/rates">${esc(I18n.t("side.more"))}</a>
  </section>`;
}

function miniScores() {
  const rows = Store.globalBoard().slice(0, 5);
  const list = rows.length
    ? `<ol class="mini-board mini-players">${rows.map((row, index) => {
      const name = row.username || I18n.t("unknown");
      return `<li>
        <span class="rank">${index + 1}</span>
        ${avatarHtml(row.userId, name)}
        <span>${esc(name)}</span>
        <span>${esc(String(row.points))}</span>
      </li>`;
    }).join("")}</ol>`
    : `<p>${esc(I18n.t("side.emptyScores"))}</p>`;
  return `<section class="panel side-card">
    <h2>${esc(I18n.t("side.scores"))}</h2>
    ${list}
    <a class="btn btn-cream" href="#/board">${esc(I18n.t("side.more"))}</a>
  </section>`;
}

function renderWelcome() {
  openGameId = null;
  app.innerHTML = `
    <section class="welcome panel">
      <img src="assets/mascot.png?v=corgi" alt="">
      <h1>${esc(I18n.t("welcome.title"))}</h1>
      <p>${esc(I18n.t("welcome.lead"))}</p>
      <div class="welcome-actions">
        <a class="btn" href="#/register">${esc(I18n.t("welcome.register"))}</a>
        <a class="btn btn-pink" href="#/login">${esc(I18n.t("welcome.login"))}</a>
      </div>
      <p class="fine">${esc(I18n.t("auth.fine"))}</p>
    </section>`;
}

function renderHub() {
  openGameId = null;
  app.innerHTML = `
    <div class="hub">
      <div>
        <a class="btn btn-cream btn-small back" href="#/">${iconBack()} ${esc(I18n.t("nav.home"))}</a>
        <header class="page-title">
          <h1>${esc(I18n.t("hub.title"))}</h1>
          <p>${esc(I18n.t("hub.lead"))}</p>
        </header>
        <a class="btn shop-open" href="#/shop">${esc(I18n.t("shop.open"))}</a>
        <div class="cat-grid">${catCards()}</div>
        <p class="foot-links"><a href="#/guide">${esc(I18n.t("home.guide"))}</a></p>
      </div>
      <aside class="hub-side">
        ${miniRates()}
        ${miniScores()}
      </aside>
    </div>`;
}

function renderRates() {
  openGameId = null;
  const top = topRated(GAMES.length);
  const rows = top.length
    ? `<ol class="board">${top.map((item, index) => {
      const cat = categoryById(item.game.category);
      return `<li class="rank-${index + 1}">
        <span class="rank">${index + 1}</span>
        <a class="player" href="#/g/${item.game.id}">${esc(gameText(item.game, "title"))}</a>
        <span class="pts">${esc(formatAvg(item.average))} · ${esc(catName(cat))}</span>
      </li>`;
    }).join("")}</ol>`
    : `<p>${esc(I18n.t("side.emptyRates"))}</p>`;
  app.innerHTML = `
    <a class="btn btn-cream btn-small back" href="#/c">${iconBack()} ${esc(I18n.t("nav.all"))}</a>
    <header class="page-title">
      <h1>${esc(I18n.t("rates.title"))}</h1>
      <p>${esc(I18n.t("rates.lead"))}</p>
    </header>
    <section class="panel">${rows}</section>`;
}

function renderCategory(id) {
  openGameId = null;
  const cat = categoryById(id);
  if (!cat) {
    app.innerHTML = missing(I18n.t("cat.missing"));
    return;
  }
  const games = gamesIn(id);
  app.innerHTML = `
    <a class="btn btn-cream btn-small back" href="#/c">${iconBack()} ${esc(I18n.t("nav.all"))}</a>
    <header class="page-head">
      <img src="${cat.icon}" alt="">
      <div>
        <h1>${esc(catName(cat))}</h1>
        <p>${esc(I18n.t("cat.lead"))}</p>
      </div>
    </header>
    <div class="game-list">
      ${games.length ? games.map((game) => {
        const best = Store.myBest(game.id);
        const max = gameMax(game);
        const bestText = best ? tf("best.mine", { raw: best.raw, max }) : I18n.t("best.none");
        return `<article class="game-row">
          <img src="${game.icon || cat.icon}" alt="">
          <div>
            <h2>${esc(gameText(game, "title"))}</h2>
            <p>${esc(gameText(game, "blurb"))}</p>
            <p class="meta"><span class="pill">${esc(levelText(game.level))}</span><span>${esc(bestText)}</span>${rateMini(game.id)}</p>
          </div>
          <a class="btn" href="#/g/${game.id}">${esc(I18n.t("play"))}</a>
        </article>`;
      }).join("") : `<div class="empty"><p>${esc(I18n.t("cat.empty"))}</p></div>`}
    </div>`;
}

function renderGame(id) {
  const game = gameById(id);
  if (!game) {
    openGameId = null;
    app.innerHTML = missing(I18n.t("game.missing"));
    return;
  }
  openGameId = game.id;
  document.body.classList.add("playing");
  const cat = categoryById(game.category);
  const max = gameMax(game);
  const entry = game.entry || `games/play.html?id=${encodeURIComponent(game.id)}`;
  const user = Store.current();
  const loginHint = user
    ? ""
    : `<p class="hint">${esc(I18n.t("guest.hint")).replace(I18n.t("nav.login"), `<a href="#/login">${esc(I18n.t("nav.login"))}</a>`)}</p>`;
  app.innerHTML = `
    <a class="btn btn-cream btn-small back play-back" href="#/c/${game.category}">${iconBack()} ${esc(catName(cat))}</a>
    <div class="play-layout">
      <section class="stage panel">
        <div class="play-bar">
          <a class="btn btn-cream btn-small" href="#/c/${game.category}">${iconBack()} ${esc(catName(cat))}</a>
          <strong>${esc(gameText(game, "title"))}</strong>
          <button class="btn btn-small" type="button" data-play-more aria-pressed="false">${esc(I18n.t("play.board"))}</button>
        </div>
        <header class="stage-head">
          <div>
            <h1>${esc(gameText(game, "title"))}</h1>
            <p>${esc(gameText(game, "blurb"))}</p>
          </div>
          <span class="pill">${esc(levelText(game.level))}</span>
        </header>
        ${loginHint}
        <iframe title="${esc(gameText(game, "title"))}" src="${entry}"></iframe>
      </section>
      <aside class="panel side">
        ${rateMarkup(game)}
        <h2>${iconTrophy()} ${esc(I18n.t("side.title"))}</h2>
        <p class="side-note">${esc(tf("side.note", { max }))}</p>
        <div id="game-board">${boardRows(Store.gameBoard(game.id), "game", max)}</div>
      </aside>
    </div>`;
}

function renderBoard() {
  openGameId = null;
  const rows = Store.globalBoard();
  const leader = rows[0];
  const lead = leader
    ? `<section class="champion">
        ${avatarHtml(leader.userId, leader.username || I18n.t("unknown"))}
        <div>
          <p>${esc(I18n.t("board.first"))}</p>
          <strong>${esc(leader.username || I18n.t("unknown"))}</strong>
          <span>${esc(tf("board.firstMeta", leader))}</span>
        </div>
      </section>`
    : "";
  app.innerHTML = `
    <a class="btn btn-cream btn-small back" href="#/c">${iconBack()} ${esc(I18n.t("nav.all"))}</a>
    <header class="page-title">
      <h1>${esc(I18n.t("board.title"))}</h1>
      <p>${esc(I18n.t("board.lead"))}</p>
    </header>
    ${lead}
    <section class="panel">${boardRows(rows, "global")}</section>`;
}

function renderUserPet(id) {
  openGameId = null;
  const person = Store.userById(id);
  if (!person) {
    app.innerHTML = missing(I18n.t("pet.missing"));
    return;
  }
  const pet = Store.petCard(person.id);
  const mine = Store.current();
  const name = person.username || I18n.t("unknown");
  const home = mine && mine.id === person.id
    ? `<a class="btn btn-cream" href="#/">${esc(I18n.t("pet.mine"))}</a>`
    : "";
  const body = pet
    ? `<p class="pet-stage">${esc(I18n.t("pet.species." + pet.species))} · ${esc(I18n.t("pet." + pet.id))} · ${esc(tf("pet.xp", { n: pet.xp }))}</p>
      <div class="pet-bar" role="progressbar" aria-valuenow="${pet.xp}" aria-valuemin="0" aria-valuemax="${pet.next || pet.xp}" aria-label="${esc(I18n.t("pet." + pet.id))}"><span style="width:${Math.max(0, Math.min(100, Math.round(pet.into * 100)))}%"></span></div>
      <p>${esc(pet.next == null ? I18n.t("pet.max") : tf("pet.next", { left: pet.next - pet.xp }))}</p>
      <div class="pet-stage-wrap">
        <img class="pet-still" src="${petSrc(pet.species, pet.stage)}" alt="">
      </div>`
    : `<p>${esc(I18n.t("pet.none"))}</p>`;
  app.innerHTML = `
    <a class="btn btn-cream btn-small back" href="#/board">${iconBack()} ${esc(I18n.t("nav.board"))}</a>
    <section class="pet-room panel">
      <h1>${esc(tf("pet.look", { name }))}</h1>
      ${body}
      ${home}
    </section>`;
}

function renderShop(cat) {
  openGameId = null;
  const pet = Store.petView();
  const active = cat === "home" || cat === "food" ? cat : "look";
  const tabs = ["look", "home", "food"].map((id) => `
    <a class="shop-cat${id === active ? " on" : ""}" href="#/shop/${id}"${id === active ? ' aria-current="page"' : ""}>${esc(I18n.t("shop." + id))}</a>`).join("");
  const note = active === "look" ? I18n.t("shop.soon") : I18n.t("shop.later");
  app.innerHTML = `
    <a class="btn btn-cream btn-small back" href="#/c">${iconBack()} ${esc(I18n.t("nav.all"))}</a>
    <section class="pet-room panel">
      <h1>${esc(I18n.t("shop.title"))}</h1>
      <p class="coin-line">${esc(tf("shop.coins", { n: pet && pet.coins ? pet.coins : 0 }))}</p>
      <p>${esc(I18n.t("shop.lead"))}</p>
      <div class="shop-cats">${tabs}</div>
      <p class="shop-empty">${esc(note)}</p>
    </section>`;
}

function renderAuth(mode) {
  openGameId = null;
  const isRegister = mode === "register";
  const cloud = Store.cloud;
  const lead = cloud
    ? (isRegister ? "auth.registerLeadCloud" : "auth.loginLeadCloud")
    : (isRegister ? "auth.registerLead" : "auth.loginLead");
  app.innerHTML = `
    <section class="auth panel">
      <img src="assets/mascot.png?v=corgi" alt="">
      <h1>${esc(I18n.t(isRegister ? "auth.create" : "auth.welcome"))}</h1>
      <p>${esc(I18n.t(lead))}</p>
      <form id="auth-form" data-mode="${mode}">
        ${cloud ? `<label>${esc(I18n.t("auth.email"))}<input name="email" type="email" autocomplete="email" required></label>` : ""}
        ${!cloud || isRegister ? `<label>${esc(I18n.t("auth.username"))}<input name="username" autocomplete="username" maxlength="12" required></label>` : ""}
        <label>${esc(I18n.t("auth.password"))}<input name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="6" maxlength="32" required></label>
        ${isRegister ? `<label>${esc(I18n.t("auth.again"))}<input name="again" type="password" autocomplete="new-password" minlength="6" maxlength="32" required></label>` : ""}
        <p class="form-error" id="form-error"></p>
        <button class="btn" type="submit">${esc(I18n.t(isRegister ? "auth.submitRegister" : "auth.submitLogin"))}</button>
      </form>
      <p class="switch">${isRegister
        ? `${esc(I18n.t("auth.toLogin"))}<a href="#/login">${esc(I18n.t("auth.toLoginLink"))}</a>`
        : `${esc(I18n.t("auth.toRegister"))}<a href="#/register">${esc(I18n.t("auth.toRegisterLink"))}</a>`}</p>
      <p class="fine">${esc(I18n.t(cloud ? "auth.fineCloud" : "auth.fine"))}</p>
    </section>`;
  const input = app.querySelector(cloud ? "input[name=email]" : "input[name=username]");
  if (input) input.focus();
}

function renderGuide() {
  openGameId = null;
  app.innerHTML = `
    <a class="btn btn-cream btn-small back" href="#/">${iconBack()} ${esc(I18n.t("nav.home"))}</a>
    <article class="panel guide">
      <h1>${esc(I18n.t("guide.title"))}</h1>
      <ol>
        <li>${esc(I18n.t("guide.1"))}</li>
        <li>${esc(I18n.t("guide.2"))}</li>
        <li>${esc(I18n.t("guide.3"))}</li>
      </ol>
      <pre>parent.postMessage({ type: "game-score", score: 8 }, location.origin);</pre>
      <p>${esc(I18n.t("guide.note"))}</p>
    </article>`;
}

function missing(text) {
  openGameId = null;
  return `<section class="panel empty-page"><h1>${esc(text)}</h1><a class="btn" href="#/">${esc(I18n.t("nav.home"))}</a></section>`;
}

function render() {
  document.body.classList.remove("playing");
  renderChrome();
  renderAccount();
  const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/").filter(Boolean);
  const [head, id] = parts;
  const user = Store.current();
  if (user && (head === "login" || head === "register")) {
    location.hash = "#/";
    return;
  }
  if (user && Store.petView().needsChoice) {
    if (head) {
      location.hash = "#/";
      return;
    }
    renderPetChoice();
    window.scrollTo(0, 0);
    return;
  }
  if (!user && head !== "login" && head !== "register" && head !== "guide") {
    if (head) {
      location.hash = "#/";
      return;
    }
    renderWelcome();
    window.scrollTo(0, 0);
    return;
  }
  if (head === "c" && id) renderCategory(id);
  else if (head === "c") renderHub();
  else if (head === "g") renderGame(id);
  else if (head === "board") renderBoard();
  else if (head === "u") renderUserPet(id);
  else if (head === "rates") renderRates();
  else if (head === "shop") renderShop(id);
  else if (head === "login") renderAuth("login");
  else if (head === "register") renderAuth("register");
  else if (head === "guide") renderGuide();
  else renderPetPage();
  window.scrollTo(0, 0);
}

document.body.addEventListener("click", async (event) => {
  const more = event.target.closest("[data-play-more]");
  if (more) {
    const side = document.querySelector(".play-layout .side");
    if (side) {
      const open = side.classList.toggle("is-open");
      more.setAttribute("aria-pressed", open ? "true" : "false");
    }
    return;
  }
  const petButton = event.target.closest("[data-pet]");
  if (petButton) {
    const chosen = await Store.choosePet(petButton.dataset.pet);
    if (!chosen.ok) {
      showToast(I18n.t("pet.pick.err"));
      return;
    }
    showToast(tf("pet.pick.done", { species: I18n.t("pet.species." + chosen.species) }));
    render();
    return;
  }
  const sizeButton = event.target.closest("#sizes button[data-size]");
  if (sizeButton) {
    applySize(sizeButton.dataset.size);
    renderChrome();
    return;
  }
  const langButton = event.target.closest("[data-lang]");
  if (langButton) {
    I18n.set(langButton.dataset.lang);
    render();
    return;
  }
  const rateHit = event.target.closest("#rate-box [data-rate]");
  if (rateHit && openGameId) {
    const game = gameById(openGameId);
    const rated = await Store.setRating(openGameId, rateHit.dataset.rate);
    if (!rated.ok) {
      showToast(I18n.t("rate.err." + rated.error));
      return;
    }
    const box = document.querySelector("#rate-box");
    if (box && game) box.outerHTML = rateMarkup(game);
    showToast(tf("rate.saved", { stars: formatStars(rated.stars) }));
    return;
  }
  if (event.target.closest("[data-logout]")) {
    Store.logout();
    location.hash = "#/";
    render();
  }
});

document.body.addEventListener("mouseover", (event) => {
  const hit = event.target.closest(".rate-pick [data-rate]");
  if (!hit) return;
  paintStars(hit.closest(".rate-pick"), Number(hit.dataset.rate));
});

document.body.addEventListener("mouseout", (event) => {
  const pick = event.target.closest(".rate-pick");
  if (!pick || pick.contains(event.relatedTarget)) return;
  paintStars(pick, Number(pick.dataset.value) || 0);
});

document.body.addEventListener("focusin", (event) => {
  const hit = event.target.closest(".rate-pick [data-rate]");
  if (!hit) return;
  paintStars(hit.closest(".rate-pick"), Number(hit.dataset.rate));
});

document.body.addEventListener("focusout", (event) => {
  const pick = event.target.closest(".rate-pick");
  if (!pick || pick.contains(event.relatedTarget)) return;
  paintStars(pick, Number(pick.dataset.value) || 0);
});

document.body.addEventListener("submit", async (event) => {
  const form = event.target.closest("#auth-form");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const username = String(data.get("username") || "");
  const password = String(data.get("password") || "");
  const email = String(data.get("email") || "");
  const error = form.querySelector("#form-error");
  let result;
  if (form.dataset.mode === "register") {
    if (password !== String(data.get("again") || "")) {
      error.textContent = I18n.t("err.mismatch");
      return;
    }
    result = await Store.register(username, password, email);
  } else {
    result = await Store.login(username, password, email);
  }
  if (!result.ok) {
    error.textContent = I18n.t("err." + result.error);
    return;
  }
  const next = sessionStorage.getItem("pixel-next");
  sessionStorage.removeItem("pixel-next");
  location.hash = next && next.startsWith("#/") ? next : "#/";
  showToast(tf("hello", { name: result.user.username }));
  render();
});

window.addEventListener("hashchange", () => {
  if (location.hash === "#/login" || location.hash === "#/register") {
    const previous = sessionStorage.getItem("pixel-from");
    if (previous && previous.startsWith("#/g/")) sessionStorage.setItem("pixel-next", previous);
    else sessionStorage.removeItem("pixel-next");
  }
  render();
});

document.body.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (href === "#/login" || href === "#/register") {
    if (location.hash.startsWith("#/g/")) sessionStorage.setItem("pixel-from", location.hash);
    return;
  }
  if (!href.startsWith("#/g/")) sessionStorage.removeItem("pixel-from");
});

window.addEventListener("message", async (event) => {
  if (event.origin !== location.origin) return;
  if (!event.data) return;
  if (event.data.type === "game-height") {
    if (window.innerWidth < 1100) return;
    const frame = document.querySelector(".stage iframe");
    const next = Math.min(760, Math.max(360, Number(event.data.height) || 0));
    if (frame && next) frame.style.height = next + "px";
    return;
  }
  const isBoardScore = event.data.type === "game-score" || event.data.type === "mkpc:score";
  if (!isBoardScore) return;
  if (event.data.metadata && event.data.metadata.leave && !Number(event.data.score)) return;
  if (!openGameId) return;
  const game = gameById(openGameId);
  if (!game) return;
  const max = gameMax(game);
  const result = await Store.submitScore(game.id, event.data.score, max);
  const board = document.querySelector("#game-board");
  if (board) board.innerHTML = boardRows(Store.gameBoard(game.id), "game", max);
  const rate = document.querySelector("#rate-box");
  if (rate) rate.outerHTML = rateMarkup(game);
  renderAccount();
  const pet = result.ok ? await Store.gainPetXp() : null;
  const extra = petToast(pet) + coinToast(pet);
  if (!result.ok && result.reason === "auth") {
    showToast(tf("toast.guest", { raw: result.raw, max }));
    return;
  }
  if (result.ok && result.improved) {
    showToast(tf("toast.best", result) + extra);
    return;
  }
  if (result.ok) {
    showToast(tf("toast.kept", result) + extra);
  }
});

applySize(localStorage.getItem("pixel-study-size") || "phone");
Store.ready.then(render);
