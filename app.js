// Daybreak UI: renders state, wires events, persists to localStorage.
(() => {
  const C = globalThis.DaybreakCore;
  const STORE_KEY = "daybreak.v1";
  const REMINDER_KEY = "daybreak.reminder";
  const HEATMAP_WEEKS = 12;
  const REMINDER_CHECK_MS = 30000;
  const TOAST_MS = 2200;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const COLORS = ["#f59e0b", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#84cc16"];
  const $ = (id) => document.getElementById(id);

  const today = () => C.toKey(new Date());
  let state = load();
  let selected = today();
  let view = "today";
  let draft = { days: [0, 1, 2, 3, 4, 5, 6], color: COLORS[0] };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? C.parseImport(raw) : C.emptyState();
    } catch (err) {
      console.error("Daybreak: could not read saved data", err);
      return C.emptyState();
    }
  }

  function commit(next) {
    state = next;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("Daybreak: could not save", err);
      toast("Couldn't save. Storage may be full or blocked.");
    }
    render();
  }

  function toast(msg) {
    const node = $("toast");
    node.textContent = msg;
    node.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => node.classList.remove("show"), TOAST_MS);
  }

  function el(tag, props = {}, children = []) {
    const node = Object.assign(document.createElement(tag), props);
    for (const child of [].concat(children)) node.append(child);
    return node;
  }

  function daysLabel(days) {
    if (days.length === 7) return "Every day";
    if (days.join() === "1,2,3,4,5") return "Weekdays";
    if (days.join() === "0,6") return "Weekends";
    return days.map((d) => DAY_NAMES[d]).join(" ");
  }

  // ---------- Today ----------
  function renderWeek() {
    const start = C.addDays(selected, -C.fromKey(selected).getDay());
    const buttons = Array.from({ length: 7 }, (_, i) => {
      const key = C.addDays(start, i);
      const score = C.dayScore(state, key);
      const b = el("button", { className: [key === selected && "sel", score === 1 && "full"].filter(Boolean).join(" ") }, [
        DAY_NAMES[i].slice(0, 1), el("b", { textContent: C.fromKey(key).getDate() }),
      ]);
      b.onclick = () => { selected = key; render(); };
      return b;
    });
    $("week").replaceChildren(...buttons);
  }

  function renderHabits() {
    const due = state.habits.filter((h) => C.isScheduled(h, selected));
    const future = selected > today();
    const items = due.map((h) => {
      const done = C.isDone(state, h.id, selected);
      const streak = C.currentStreak(state, h, today());
      const check = el("button", { className: "check" + (done ? " done" : ""), textContent: done ? "✓" : "", disabled: future, ariaLabel: `Mark ${h.name} done` });
      check.onclick = () => commit(C.toggleHabit(state, h.id, selected));
      const del = el("button", { className: "del", textContent: "⋯", ariaLabel: `Delete ${h.name}` });
      del.onclick = () => { if (confirm(`Delete "${h.name}" and its history?`)) commit(C.removeHabit(state, h.id)); };
      const li = el("li", { className: done ? "done" : "" }, [
        el("span", { className: "emoji", textContent: h.emoji }),
        el("div", { className: "meta" }, [el("b", { textContent: h.name }), el("small", { textContent: `🔥 ${streak} · ${daysLabel(h.days)}` })]),
        del, check,
      ]);
      li.style.setProperty("--c", h.color);
      return li;
    });
    $("habitList").replaceChildren(...items);
    $("habitEmpty").hidden = state.habits.length > 0;
    const score = C.dayScore(state, selected) || 0;
    $("ring").style.setProperty("--p", Math.round(score * 100));
    $("ringText").textContent = `${Math.round(score * 100)}%`;
  }

  function renderTasks() {
    const items = (state.tasks[selected] || []).map((t) => {
      const box = el("input", { type: "checkbox", checked: t.done, ariaLabel: t.text });
      box.onchange = () => commit(C.toggleTask(state, selected, t.id));
      const del = el("button", { className: "del", textContent: "×", ariaLabel: `Remove ${t.text}` });
      del.onclick = () => commit(C.removeTask(state, selected, t.id));
      return el("li", { className: t.done ? "done" : "" }, [box, el("span", { textContent: t.text }), del]);
    });
    $("taskList").replaceChildren(...items);
  }

  // ---------- Stats ----------
  function renderStats() {
    const pct = (x) => `${Math.round(x * 100)}%`;
    $("rate7").textContent = pct(C.completionRate(state, today(), C.STATS_SHORT_DAYS));
    $("rate30").textContent = pct(C.completionRate(state, today(), C.STATS_LONG_DAYS));
    $("bestAll").textContent = Math.max(0, ...state.habits.map((h) => C.bestStreak(state, h, today())));

    const end = C.addDays(today(), 6 - C.fromKey(today()).getDay());
    const start = C.addDays(end, -(HEATMAP_WEEKS * 7 - 1));
    const cells = Array.from({ length: HEATMAP_WEEKS * 7 }, (_, i) => {
      const key = C.addDays(start, i);
      const score = key > today() ? null : C.dayScore(state, key);
      const cell = el("i", { title: `${key}: ${score === null ? "no habits due" : pct(score)}` });
      if (score) cell.style.background = `color-mix(in srgb, var(--accent) ${Math.round(25 + score * 75)}%, var(--heat0))`;
      return cell;
    });
    $("heatmap").replaceChildren(...cells);

    const rows = state.habits.map((h) => el("li", {}, [
      el("span", { textContent: `${h.emoji} ${h.name}` }),
      el("small", { textContent: `🔥 ${C.currentStreak(state, h, today())} now · best ${C.bestStreak(state, h, today())}` }),
    ]));
    $("habitStats").replaceChildren(...(rows.length ? rows : [el("p", { className: "empty", textContent: "Add a habit to see stats." })]));
  }

  // ---------- Settings ----------
  function applyTheme() {
    if (state.theme === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme = state.theme;
    for (const b of $("themeSeg").children) b.classList.toggle("on", b.dataset.theme === state.theme);
  }

  function render() {
    applyTheme();
    const sel = C.fromKey(selected);
    $("dateLabel").textContent = sel.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    $("viewTitle").textContent = { today: selected === today() ? "Today" : "Day view", stats: "Progress", settings: "Settings" }[view];
    for (const v of ["today", "stats", "settings"]) $(`view-${v}`).hidden = v !== view;
    for (const b of document.querySelectorAll(".tabs button")) b.classList.toggle("on", b.dataset.view === view);
    $("fab").hidden = view !== "today";
    if (view === "today") { renderWeek(); renderHabits(); renderTasks(); }
    if (view === "stats") renderStats();
  }

  // ---------- Habit dialog ----------
  function renderDialogPickers() {
    $("dayPicker").replaceChildren(...DAY_NAMES.map((name, d) => {
      const b = el("button", { type: "button", textContent: name.slice(0, 2), className: draft.days.includes(d) ? "on" : "" });
      b.onclick = () => {
        draft = { ...draft, days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() };
        renderDialogPickers();
      };
      return b;
    }));
    $("colorPicker").replaceChildren(...COLORS.map((c) => {
      const b = el("button", { type: "button", className: c === draft.color ? "on" : "", ariaLabel: `Colour ${c}` });
      b.style.setProperty("--c", c);
      b.onclick = () => { draft = { ...draft, color: c }; renderDialogPickers(); };
      return b;
    }));
  }

  function openHabitDialog() {
    draft = { days: [0, 1, 2, 3, 4, 5, 6], color: COLORS[state.habits.length % COLORS.length] };
    $("habitName").value = "";
    $("habitEmoji").value = "✅";
    $("habitError").textContent = "";
    const taken = new Set(state.habits.map((h) => h.name));
    $("suggestions").replaceChildren(...C.SUGGESTIONS.filter((s) => !taken.has(s.name)).map((s) => {
      const b = el("button", { type: "button", textContent: `${s.emoji} ${s.name}` });
      b.onclick = () => { $("habitName").value = s.name; $("habitEmoji").value = s.emoji; };
      return b;
    }));
    renderDialogPickers();
    $("habitDialog").showModal();
  }

  $("habitForm").addEventListener("submit", (e) => {
    if (e.submitter?.value !== "save") return;
    try {
      const next = C.addHabit(state, { name: $("habitName").value, emoji: $("habitEmoji").value.trim(), color: draft.color, days: draft.days }, today());
      commit(next);
      toast("Habit added");
    } catch (err) {
      e.preventDefault();
      $("habitError").textContent = err.message;
    }
  });

  // ---------- Reminders ----------
  function checkReminder() {
    const time = localStorage.getItem(REMINDER_KEY);
    if (!time || !("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const firedKey = `${REMINDER_KEY}.fired`;
    if (hhmm < time || localStorage.getItem(firedKey) === today()) return;
    const left = state.habits.filter((h) => C.isScheduled(h, today()) && !C.isDone(state, h.id, today())).length;
    localStorage.setItem(firedKey, today());
    if (left > 0) new Notification("Daybreak", { body: `${left} habit${left > 1 ? "s" : ""} left today. Keep the streak alive.`, icon: "icon.svg" });
  }

  async function enableReminder() {
    const time = $("reminderTime").value;
    if (!time) return toast("Pick a time first");
    if (!("Notification" in window)) return toast("This browser doesn't support notifications");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return toast("Notifications were not allowed");
    localStorage.setItem(REMINDER_KEY, time);
    toast(`Reminder set for ${time}`);
  }

  // ---------- Backup ----------
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `daybreak-backup-${today()}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importData(file) {
    try {
      const next = C.parseImport(await file.text());
      if (!confirm(`Replace current data with ${next.habits.length} habits from this backup?`)) return;
      commit(next);
      toast("Backup restored");
    } catch (err) {
      toast(err.message);
    }
  }

  // ---------- Wiring ----------
  $("fab").onclick = openHabitDialog;
  $("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("taskInput").value;
    if (!text.trim()) return;
    commit(C.addTask(state, selected, text));
    $("taskInput").value = "";
  });
  $("copyYesterday").onclick = () => {
    const { state: next, count } = C.copyUnfinishedFromYesterday(state, selected);
    if (count === 0) return toast("Nothing unfinished from yesterday");
    commit(next);
    toast(`Copied ${count} task${count > 1 ? "s" : ""}`);
  };
  for (const b of document.querySelectorAll(".tabs button")) b.onclick = () => { view = b.dataset.view; render(); };
  for (const b of $("themeSeg").children) b.onclick = () => commit({ ...state, theme: b.dataset.theme });
  $("reminderTime").value = localStorage.getItem(REMINDER_KEY) || "20:00";
  $("reminderBtn").onclick = enableReminder;
  $("exportBtn").onclick = exportData;
  $("importFile").onchange = (e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; };

  setInterval(checkReminder, REMINDER_CHECK_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { checkReminder(); render(); } });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch((err) => console.error("Daybreak: service worker failed", err));
  }
  render();
})();
