/* 三年級磁浮列車 6 米賽道。
   每組兩次完賽時間，取較快的一次當完成時間。
   速率（米/秒）＝ 6 ÷ 完成時間（秒）。
   老師頁和大螢幕共用這一份成績。 */
(function (root) {
  var TRACK_M = 6;
  var CLASS_IDS = ["A", "B", "C", "D", "E"];
  var DEFAULT_GROUPS = 5;
  var MAX_GROUPS = 8;
  var ROW_ID = "p3";
  var LOCAL_KEY = "maglev-meet-p3";
  var BUS_NAME = "maglev-meet-p3";

  function className(id) {
    return "3" + id;
  }

  function trainIcon() {
    return '<svg class="train" viewBox="0 0 64 48" aria-hidden="true"><rect x="4" y="18" width="34" height="18" rx="8" fill="currentColor"/><rect x="30" y="8" width="22" height="28" rx="8" fill="currentColor"/><rect x="36" y="14" width="10" height="8" rx="2" fill="#fff7d6"/><circle cx="16" cy="38" r="5" fill="#fff"/><circle cx="42" cy="38" r="5" fill="#fff"/><circle cx="16" cy="38" r="2" fill="currentColor"/><circle cx="42" cy="38" r="2" fill="currentColor"/></svg>';
  }

  function medalIcon(place) {
    var tone = {
      1: ["#ffe08a", "#f0b429", "#8a5a00"],
      2: ["#f3f6fa", "#b7c3d0", "#526273"],
      3: ["#ffd0a6", "#e08a45", "#8a4b16"]
    }[place] || ["#e8eef5", "#b7c3d0", "#526273"];
    return '<svg class="medal-ico" viewBox="0 0 64 64" aria-hidden="true"><path d="M22 6h8l2 16h-12z" fill="' + tone[2] + '"/><path d="M34 6h8l-2 16h-8z" fill="' + tone[1] + '"/><circle cx="32" cy="38" r="18" fill="' + tone[0] + '" stroke="' + tone[1] + '" stroke-width="4"/><text x="32" y="45" text-anchor="middle" font-size="20" font-weight="700" fill="' + tone[2] + '">' + place + "</text></svg>";
  }

  function cleanTime(value) {
    if (value == null || value === "") return null;
    var n = Number(value);
    if (!isFinite(n) || n <= 0 || n > 600) return null;
    return Math.round(n * 100) / 100;
  }

  function parseTime(text) {
    var raw = String(text == null ? "" : text).trim().replace(/秒/g, "").replace(/，/g, ".").replace(",", ".");
    if (!raw) return { ok: true, value: null };
    if (/^\d+\.$/.test(raw)) return { ok: true, pending: true };
    if (!/^\d+(\.\d+)?$/.test(raw)) return { ok: false };
    var n = Number(raw);
    if (!isFinite(n) || n <= 0 || n > 600) return { ok: false };
    return { ok: true, value: Math.round(n * 100) / 100 };
  }

  function blankGroup(classId, n) {
    return { id: classId + n, label: "第" + n + "組", t1: null, t2: null };
  }

  function defaultGroups(classId, count) {
    var groups = [];
    for (var n = 1; n <= count; n++) groups.push(blankGroup(classId, n));
    return groups;
  }

  function normalizeGroup(group, classId) {
    if (!group || typeof group.id !== "string" || group.id.indexOf(classId) !== 0) return null;
    return {
      id: group.id.slice(0, 12),
      label: String(group.label == null ? "" : group.label).trim().slice(0, 10),
      t1: cleanTime(group.t1),
      t2: cleanTime(group.t2)
    };
  }

  function normalize(raw) {
    var src = raw && typeof raw === "object" ? raw : {};
    var found = Array.isArray(src.classes) ? src.classes : [];
    return {
      rev: Number(src.rev) || 0,
      trackM: TRACK_M,
      classes: CLASS_IDS.map(function (id) {
        var row = null;
        for (var i = 0; i < found.length; i++) {
          if (found[i] && found[i].id === id) row = found[i];
        }
        var groups = [];
        var incoming = row && Array.isArray(row.groups) ? row.groups : [];
        for (var g = 0; g < incoming.length && groups.length < MAX_GROUPS; g++) {
          var item = normalizeGroup(incoming[g], id);
          if (item && !groups.some(function (have) { return have.id === item.id; })) groups.push(item);
        }
        if (!groups.length) groups = defaultGroups(id, DEFAULT_GROUPS);
        return { id: id, name: className(id), groups: groups };
      })
    };
  }

  function blank() {
    return normalize({ rev: 0, classes: [] });
  }

  function groupTitle(group, index) {
    var label = group && String(group.label || "").trim();
    return label || ("第" + (index + 1) + "組");
  }

  function results(groups) {
    return (groups || []).map(function (group, index) {
      var attempts = [group.t1, group.t2].filter(function (t) { return t != null; });
      var best = attempts.length ? Math.min.apply(null, attempts) : null;
      return {
        id: group.id,
        label: groupTitle(group, index),
        index: index,
        t1: group.t1,
        t2: group.t2,
        best: best,
        which: best == null ? 0 : (group.t1 === best ? 1 : 2),
        speed: best == null ? null : TRACK_M / best
      };
    });
  }

  function ranked(groups) {
    return results(groups)
      .filter(function (row) { return row.best != null; })
      .sort(function (a, b) { return a.best - b.best || a.index - b.index; })
      .map(function (row, index) {
        row.place = index + 1;
        return row;
      });
  }

  function top3(groups) {
    return ranked(groups).slice(0, 3);
  }

  function formatNum(n) {
    return Number(n).toFixed(2);
  }

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
    } catch (err) {
      return null;
    }
  }

  function writeLocal(state) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    } catch (err) {
      /* 私人模式寫不入時，這一頁仍可看 */
    }
  }

  function client() {
    var cloudUrl = typeof SUPABASE_URL === "string" ? SUPABASE_URL.trim() : "";
    var cloudKey = typeof SUPABASE_ANON_KEY === "string" ? SUPABASE_ANON_KEY.trim() : "";
    if (!cloudUrl.startsWith("https://") || cloudKey.length < 21 || typeof supabase === "undefined") return null;
    return supabase.createClient(cloudUrl, cloudKey);
  }

  function needsSql(error) {
    var message = String(error && (error.message || error.details || error.code) || "");
    return /maglev_meet|schema cache|relation|PGRST205|42P01/i.test(message);
  }

  function openSession(onChange) {
    var state = normalize(readLocal() || blank());
    var status = "local";
    var detail = "";
    var serverAt = "";
    var dirty = 0;
    var acked = 0;
    var closed = false;
    var db = client();
    var bus = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(BUS_NAME) : null;
    var timer = 0;

    function emit() {
      onChange({ state: state, status: status, detail: detail, trackM: TRACK_M });
    }

    function replace(next, fromCloudAt) {
      var normalized = normalize(next);
      if (fromCloudAt) serverAt = fromCloudAt;
      if (JSON.stringify(normalized) === JSON.stringify(state)) {
        emit();
        return;
      }
      state = normalized;
      writeLocal(state);
      emit();
    }

    function publish(next) {
      state = next;
      writeLocal(state);
      if (bus) bus.postMessage({ payload: state });
      emit();
    }

    async function push() {
      if (!db) return;
      var mark = dirty;
      var snapshot = state;
      var saved = await db.from("maglev_meet").upsert({ id: ROW_ID, payload: snapshot }).select("updated_at").single();
      if (closed || mark !== dirty) return;
      if (saved.error) {
        status = needsSql(saved.error) ? "need-sql" : "error";
        detail = saved.error.message || "";
        emit();
        if (!closed) scheduleRetry();
        return;
      }
      acked = mark;
      serverAt = saved.data && saved.data.updated_at || serverAt;
      status = "cloud";
      detail = "";
      emit();
    }

    var pushTimer = 0;
    var retryTimer = 0;
    function schedulePush() {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(push, 280);
    }
    function scheduleRetry() {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(push, 4000);
    }

    function update(mutator) {
      var draft = JSON.parse(JSON.stringify(state));
      mutator(draft);
      draft.rev = (Number(draft.rev) || 0) + 1;
      var next = normalize(draft);
      next.rev = draft.rev;
      dirty += 1;
      publish(next);
      schedulePush();
    }

    async function pull() {
      if (!db || dirty !== acked || closed) return;
      var loaded = await db.from("maglev_meet").select("payload,updated_at").eq("id", ROW_ID).maybeSingle();
      if (closed || dirty !== acked) return;
      if (loaded.error) {
        status = needsSql(loaded.error) ? "need-sql" : "error";
        detail = loaded.error.message || "";
        emit();
        return;
      }
      if (!loaded.data) {
        status = "cloud";
        detail = "";
        push();
        return;
      }
      if (loaded.data.updated_at && loaded.data.updated_at === serverAt) {
        if (status !== "cloud") {
          status = "cloud";
          detail = "";
          emit();
        }
        return;
      }
      status = "cloud";
      detail = "";
      replace(loaded.data.payload, loaded.data.updated_at || "");
    }

    function onBus(payload) {
      if (dirty !== acked || !payload) return;
      replace(payload);
    }

    if (bus) bus.onmessage = function (event) { onBus(event.data && event.data.payload); };
    window.addEventListener("storage", function (event) {
      if (event.key !== LOCAL_KEY) return;
      try { onBus(JSON.parse(event.newValue || "null")); } catch (err) { /* 忽略壞掉的本地備份 */ }
    });

    emit();
    if (db) {
      pull();
      db.channel("maglev-meet-p3")
        .on("postgres_changes", { event: "*", schema: "public", table: "maglev_meet", filter: "id=eq." + ROW_ID }, function (payload) {
          if (!payload.new || dirty !== acked) return;
          status = "cloud";
          detail = "";
          replace(payload.new.payload, payload.new.updated_at || "");
        })
        .subscribe();
      timer = setInterval(pull, 3000);
    }

    return {
      update: update,
      close: function () {
        closed = true;
        clearInterval(timer);
        clearTimeout(pushTimer);
        clearTimeout(retryTimer);
        if (bus) bus.close();
      }
    };
  }

  root.MaglevMeet = {
    TRACK_M: TRACK_M,
    CLASS_IDS: CLASS_IDS,
    DEFAULT_GROUPS: DEFAULT_GROUPS,
    MAX_GROUPS: MAX_GROUPS,
    blank: blank,
    normalize: normalize,
    parseTime: parseTime,
    results: results,
    ranked: ranked,
    top3: top3,
    formatNum: formatNum,
    groupTitle: groupTitle,
    blankGroup: blankGroup,
    trainIcon: trainIcon,
    medalIcon: medalIcon,
    openSession: openSession
  };
})(typeof window !== "undefined" ? window : globalThis);
