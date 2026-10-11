const Store = (() => {
  const KEY = "pixel-study-v1";
  const cloudUrl = typeof SUPABASE_URL === "string" ? SUPABASE_URL.trim() : "";
  const cloudKey = typeof SUPABASE_ANON_KEY === "string" ? SUPABASE_ANON_KEY.trim() : "";
  const cloudOn = cloudUrl.startsWith("https://") && cloudKey.length > 20 && typeof supabase !== "undefined";
  const db = cloudOn ? supabase.createClient(cloudUrl, cloudKey) : null;
  let state = load();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "");
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.scores)) {
        if (!Array.isArray(parsed.ratings)) parsed.ratings = [];
        if (!Array.isArray(parsed.pets)) parsed.pets = [];
        return parsed;
      }
    } catch (err) {
      /* 壞掉的存檔就從頭開始 */
    }
    return { users: [], scores: [], ratings: [], pets: [], session: null };
  }

  function save() {
    if (db) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function stamp(value) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Date.now();
  }

  async function pull() {
    if (!db) return;
    const [profiles, scores, ratings, sessionResult] = await Promise.all([
      db.from("profiles").select("id,username"),
      db.from("scores").select("user_id,game_id,raw,points,at"),
      db.from("ratings").select("user_id,game_id,stars,at"),
      db.auth.getSession(),
    ]);
    state.users = (profiles.data || []).map((row) => ({ id: row.id, username: row.username }));
    state.scores = (scores.data || []).map((row) => ({
      userId: row.user_id,
      gameId: row.game_id,
      raw: row.raw,
      points: row.points,
      at: stamp(row.at),
    }));
    state.ratings = (ratings.data || []).map((row) => ({
      userId: row.user_id,
      gameId: row.game_id,
      stars: Number(row.stars),
      at: stamp(row.at),
    }));
    state.session = sessionResult.data.session ? sessionResult.data.session.user.id : null;
    let pets = await db.from("pets").select("user_id,species,xp,day,day_xp,coins,day_coins");
    if (pets.error) pets = await db.from("pets").select("user_id,species,xp,day,day_xp");
    state.pets = (pets.data || []).map((row) => ({
      userId: row.user_id,
      species: row.species || "",
      xp: row.xp || 0,
      day: row.day || "",
      dayXp: row.day_xp || 0,
      coins: row.coins || 0,
      dayCoins: row.day_coins || 0,
    }));
  }

  async function persistPet(row) {
    if (!db) {
      save();
      return { error: null };
    }
    const full = {
      user_id: row.userId,
      species: row.species || null,
      xp: row.xp,
      day: row.day,
      day_xp: row.dayXp,
      coins: row.coins || 0,
      day_coins: row.dayCoins || 0,
    };
    let saved = await db.from("pets").upsert(full);
    const message = String(saved.error && saved.error.message || "").toLowerCase();
    if (saved.error && (message.includes("coin") || message.includes("column") || message.includes("schema"))) {
      saved = await db.from("pets").upsert({
        user_id: full.user_id,
        species: full.species,
        xp: full.xp,
        day: full.day,
        day_xp: full.day_xp,
      });
    }
    return saved;
  }

  function bytesToHex(buffer) {
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return bytesToHex(buf);
  }

  function randomSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }

  function current() {
    if (!state.session) return null;
    return state.users.find((user) => user.id === state.session) || null;
  }

  function nameOf(userId) {
    const user = state.users.find((item) => item.id === userId);
    return user ? user.username : "";
  }

  function validName(username) {
    const name = username.trim();
    if (name.length < 2) return "name-short";
    if (name.length > 12) return "name-long";
    if (/\s/.test(name)) return "name-space";
    return "";
  }

  function validEmail(email) {
    const mail = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return "";
    return mail;
  }

  async function register(username, password, email) {
    if (db) return registerCloud(username, password, email);
    const nameError = validName(username);
    if (nameError) return { ok: false, error: nameError };
    if (password.length < 6) return { ok: false, error: "password-short" };
    if (password.length > 32) return { ok: false, error: "password-long" };
    const name = username.trim();
    const taken = state.users.some((user) => user.username.toLowerCase() === name.toLowerCase());
    if (taken) return { ok: false, error: "taken" };
    const salt = randomSalt();
    const hash = await sha256(salt + password);
    const user = { id: crypto.randomUUID(), username: name, salt, hash, createdAt: Date.now() };
    state.users.push(user);
    state.session = user.id;
    save();
    return { ok: true, user };
  }

  async function registerCloud(username, password, email) {
    const nameError = validName(username);
    if (nameError) return { ok: false, error: nameError };
    if (password.length < 6) return { ok: false, error: "password-short" };
    if (password.length > 32) return { ok: false, error: "password-long" };
    const mail = validEmail(email);
    if (!mail) return { ok: false, error: "email" };
    const name = username.trim();
    const taken = await db.from("profiles").select("id").ilike("username", name).maybeSingle();
    if (taken.data) return { ok: false, error: "taken" };
    const { data, error } = await db.auth.signUp({
      email: mail,
      password,
      options: { data: { username: name } },
    });
    if (error) {
      const message = String(error.message || "").toLowerCase();
      if (message.includes("already")) return { ok: false, error: "email-taken" };
      return { ok: false, error: "bad-login" };
    }
    if (!data.session) return { ok: false, error: "confirm" };
    await db.from("profiles").upsert({ id: data.user.id, username: name });
    await pull();
    return { ok: true, user: current() };
  }

  async function login(username, password, email) {
    if (db) {
      const mail = validEmail(email || username);
      if (!mail) return { ok: false, error: "email" };
      const { error } = await db.auth.signInWithPassword({ email: mail, password });
      if (error) return { ok: false, error: "bad-login" };
      await pull();
      return { ok: true, user: current() };
    }
    const name = username.trim();
    const user = state.users.find((item) => item.username.toLowerCase() === name.toLowerCase());
    if (!user) return { ok: false, error: "bad-login" };
    const hash = await sha256(user.salt + password);
    if (hash !== user.hash) return { ok: false, error: "bad-login" };
    state.session = user.id;
    save();
    return { ok: true, user };
  }

  async function logout() {
    if (db) await db.auth.signOut();
    state.session = null;
    if (db) state.pets = [];
    save();
  }

  function persistScore(row) {
    if (!db) {
      save();
      return Promise.resolve({ error: null });
    }
    return db.from("scores").upsert({
      user_id: row.userId,
      game_id: row.gameId,
      raw: row.raw,
      points: row.points,
      at: new Date(row.at).toISOString(),
    });
  }

  async function submitScore(gameId, raw, max) {
    const user = current();
    const safeMax = Math.max(1, Number(max) || 1);
    const value = Math.max(0, Math.min(safeMax, Math.round(Number(raw))));
    if (!Number.isFinite(value)) return { ok: false, reason: "bad" };
    if (!user) return { ok: false, reason: "auth", raw: value };
    const points = Math.round((value / safeMax) * 100);
    const existing = state.scores.find((item) => item.userId === user.id && item.gameId === gameId);
    if (!existing) {
      const row = { userId: user.id, gameId, raw: value, points, at: Date.now() };
      state.scores.push(row);
      const saved = await persistScore(row);
      if (saved.error) return { ok: false, reason: "bad" };
      return { ok: true, improved: true, raw: value, points, best: value, max: safeMax };
    }
    if (value > existing.raw) {
      existing.raw = value;
      existing.points = points;
      existing.at = Date.now();
      const saved = await persistScore(existing);
      if (saved.error) return { ok: false, reason: "bad" };
      return { ok: true, improved: true, raw: value, points, best: value, max: safeMax };
    }
    return { ok: true, improved: false, raw: value, points: existing.points, best: existing.raw, max: safeMax };
  }

  function gameBoard(gameId) {
    return state.scores
      .filter((item) => item.gameId === gameId)
      .map((item) => ({ ...item, username: nameOf(item.userId) }))
      .sort((a, b) => b.raw - a.raw || a.at - b.at);
  }

  function globalBoard() {
    const map = new Map();
    state.scores.forEach((item) => {
      const row = map.get(item.userId) || { userId: item.userId, username: nameOf(item.userId), points: 0, games: 0, at: 0 };
      row.points += item.points;
      row.games += 1;
      row.at = Math.max(row.at, item.at);
      map.set(item.userId, row);
    });
    return [...map.values()].sort((a, b) => b.points - a.points || b.games - a.games || a.at - b.at);
  }

  function myBest(gameId) {
    const user = current();
    if (!user) return null;
    return state.scores.find((item) => item.userId === user.id && item.gameId === gameId) || null;
  }

  function ratingOf(gameId) {
    const rows = state.ratings.filter((item) => item.gameId === gameId && item.stars >= 0.5);
    if (!rows.length) return { average: 0, count: 0 };
    const sum = rows.reduce((total, item) => total + item.stars, 0);
    return { average: sum / rows.length, count: rows.length };
  }

  function myRating(gameId) {
    const user = current();
    if (!user) return null;
    const row = state.ratings.find((item) => item.userId === user.id && item.gameId === gameId);
    return row ? row.stars : null;
  }

  async function setRating(gameId, stars) {
    const user = current();
    if (!user) return { ok: false, error: "auth" };
    if (!myBest(gameId)) return { ok: false, error: "need-play" };
    const raw = Number(stars);
    const value = Math.round(raw * 2) / 2;
    if (!Number.isFinite(raw) || Math.abs(raw - value) > 0.001 || value < 0.5 || value > 5) {
      return { ok: false, error: "bad-stars" };
    }
    const existing = state.ratings.find((item) => item.userId === user.id && item.gameId === gameId);
    const row = existing || { userId: user.id, gameId, stars: value, at: Date.now() };
    row.stars = value;
    row.at = Date.now();
    if (!existing) state.ratings.push(row);
    if (!db) save();
    else {
      const saved = await db.from("ratings").upsert({
        user_id: row.userId,
        game_id: row.gameId,
        stars: row.stars,
        at: new Date(row.at).toISOString(),
      });
      if (saved.error) return { ok: false, error: "bad-stars" };
    }
    return { ok: true, stars: value, ...ratingOf(gameId) };
  }

  const PET_GAIN = 20;
  const PET_DAILY = 100;
  const COIN_GAIN = 10;
  const COIN_DAILY = 100;
  const PET_NEED = [0, 100, 400, 1100, 2500];
  const PET_IDS = ["bubble", "baby", "grow", "adult", "scholar"];
  const PET_SPECIES = ["tabby", "fluff", "dog", "husky", "golden", "shiba", "macaw", "bunny", "panda", "redpanda", "tortoise"];
  const PET_REPLACE = { cat: "tabby", rabbit: "dog" };

  function replaceRetired(row) {
    if (!row || !PET_REPLACE[row.species]) return;
    row.species = PET_REPLACE[row.species];
    persistPet(row);
  }

  function todayKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function stageIndex(xp) {
    let stage = 0;
    PET_NEED.forEach((need, index) => {
      if (xp >= need) stage = index;
    });
    return stage;
  }

  function findPet(user) {
    if (!Array.isArray(state.pets)) state.pets = [];
    return state.pets.find((item) => item.userId === user.id) || null;
  }

  function petRow(user) {
    const row = findPet(user);
    replaceRetired(row);
    if (!row || !row.species) return null;
    const today = todayKey();
    if (row.day !== today) {
      row.day = today;
      row.dayXp = 0;
      row.dayCoins = 0;
      persistPet(row);
    }
    return row;
  }

  function petView() {
    const user = current();
    if (!user) return null;
    const existing = findPet(user);
    if (existing && !existing.species) {
      existing.species = "dog";
      persistPet(existing);
    }
    replaceRetired(existing);
    const row = petRow(user);
    if (!row) return { needsChoice: true };
    const stage = stageIndex(row.xp);
    const next = stage < PET_NEED.length - 1 ? PET_NEED[stage + 1] : null;
    const prev = PET_NEED[stage];
    return {
      species: row.species,
      id: PET_IDS[stage],
      stage,
      xp: row.xp,
      dayXp: row.dayXp,
      daily: PET_DAILY,
      coins: row.coins || 0,
      next,
      into: next == null ? 1 : (row.xp - prev) / (next - prev),
    };
  }

  async function choosePet(species) {
    const user = current();
    if (!user) return { ok: false, error: "auth" };
    if (!PET_SPECIES.includes(species)) return { ok: false, error: "bad-pet" };
    const existing = findPet(user);
    if (existing && existing.species) return { ok: false, error: "chosen" };
    const today = todayKey();
    const row = existing || { userId: user.id, species, xp: 0, day: today, dayXp: 0, coins: 0, dayCoins: 0 };
    row.species = species;
    if (!existing) state.pets.push(row);
    const saved = await persistPet(row);
    if (saved.error) return { ok: false, error: "bad-pet" };
    return { ok: true, species };
  }

  async function gainPetXp() {
    const user = current();
    if (!user) return { ok: false, reason: "auth" };
    const row = petRow(user);
    if (!row) return { ok: false, reason: "nopet" };
    const before = stageIndex(row.xp);
    const gain = Math.min(PET_GAIN, Math.max(0, PET_DAILY - row.dayXp));
    const coinGain = Math.min(COIN_GAIN, Math.max(0, COIN_DAILY - (row.dayCoins || 0)));
    if (gain > 0) {
      row.xp += gain;
      row.dayXp += gain;
    }
    if (coinGain > 0) {
      row.coins = (row.coins || 0) + coinGain;
      row.dayCoins = (row.dayCoins || 0) + coinGain;
    }
    if (gain > 0 || coinGain > 0) {
      const saved = await persistPet(row);
      if (saved.error) return { ok: false, reason: "nopet" };
    }
    const stage = stageIndex(row.xp);
    return {
      ok: true,
      gain,
      dayXp: row.dayXp,
      daily: PET_DAILY,
      coins: row.coins || 0,
      coinGain,
      coinDaily: COIN_DAILY,
      dayCoins: row.dayCoins || 0,
      xp: row.xp,
      stage,
      species: row.species,
      id: PET_IDS[stage],
      evolved: stage > before,
    };
  }

  function shownSpecies(species) {
    if (!species) return "";
    if (PET_REPLACE[species]) return PET_REPLACE[species];
    return PET_SPECIES.includes(species) ? species : "dog";
  }

  function petCard(userId) {
    const row = (state.pets || []).find((item) => item.userId === userId);
    const species = row ? shownSpecies(row.species) : "";
    if (!species) return null;
    const stage = stageIndex(row.xp || 0);
    const next = stage < PET_NEED.length - 1 ? PET_NEED[stage + 1] : null;
    const prev = PET_NEED[stage];
    const xp = row.xp || 0;
    return {
      species,
      id: PET_IDS[stage],
      stage,
      xp,
      next,
      into: next == null ? 1 : (xp - prev) / (next - prev),
    };
  }

  function userById(userId) {
    return state.users.find((user) => user.id === userId) || null;
  }

  function mySummary() {
    const user = current();
    if (!user) return null;
    const mine = state.scores.filter((item) => item.userId === user.id);
    const points = mine.reduce((sum, item) => sum + item.points, 0);
    return { username: user.username, points, games: mine.length };
  }

  return {
    cloud: Boolean(db),
    ready: db ? pull().catch(() => {}) : Promise.resolve(),
    current, register, login, logout, submitScore, gameBoard, globalBoard, myBest, mySummary,
    ratingOf, myRating, setRating, petView, petCard, userById, choosePet, gainPetXp,
  };
})();
