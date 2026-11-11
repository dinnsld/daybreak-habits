// Pure logic for Daybreak: dates, streaks, stats and state updates.
// No DOM access, so it runs in the browser and under `node --test`.
// Every update returns a new state object; nothing is mutated in place.

const STATS_SHORT_DAYS = 7;
const STATS_LONG_DAYS = 30;

function toKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, n) {
  const date = fromKey(key);
  date.setDate(date.getDate() + n);
  return toKey(date);
}

function emptyState() {
  return { habits: [], log: {}, tasks: {}, theme: "system" };
}

function isScheduled(habit, key) {
  if (key < habit.createdAt) return false;
  return habit.days.includes(fromKey(key).getDay());
}

function isDone(state, habitId, key) {
  return (state.log[key] || []).includes(habitId);
}

// Current streak: consecutive scheduled days completed, counting back from
// `today`. An unfinished today does not break the streak (the day isn't over).
function currentStreak(state, habit, today) {
  let streak = 0;
  let key = today;
  if (isScheduled(habit, key) && !isDone(state, habit.id, key)) key = addDays(key, -1);
  while (key >= habit.createdAt) {
    if (isScheduled(habit, key)) {
      if (!isDone(state, habit.id, key)) break;
      streak += 1;
    }
    key = addDays(key, -1);
  }
  return streak;
}

function bestStreak(state, habit, today) {
  let best = 0;
  let run = 0;
  for (let key = habit.createdAt; key <= today; key = addDays(key, 1)) {
    if (!isScheduled(habit, key)) continue;
    run = isDone(state, habit.id, key) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

// Share of scheduled habit-days completed over the last `days` days.
function completionRate(state, today, days) {
  let scheduled = 0;
  let done = 0;
  for (let i = 0; i < days; i += 1) {
    const key = addDays(today, -i);
    for (const habit of state.habits) {
      if (!isScheduled(habit, key)) continue;
      scheduled += 1;
      if (isDone(state, habit.id, key)) done += 1;
    }
  }
  return scheduled === 0 ? 0 : done / scheduled;
}

function dayScore(state, key) {
  const due = state.habits.filter((h) => isScheduled(h, key));
  if (due.length === 0) return null;
  return due.filter((h) => isDone(state, h.id, key)).length / due.length;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function addHabit(state, { name, emoji, color, days }, today) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("Habit name is required");
  if (!Array.isArray(days) || days.length === 0) throw new Error("Pick at least one day");
  const habit = { id: newId(), name: trimmed.slice(0, 60), emoji: emoji || "✅", color: color || "#f59e0b", days: [...days], createdAt: today };
  return { ...state, habits: [...state.habits, habit] };
}

function removeHabit(state, habitId) {
  const log = Object.fromEntries(Object.entries(state.log).map(([k, ids]) => [k, ids.filter((id) => id !== habitId)]));
  return { ...state, habits: state.habits.filter((h) => h.id !== habitId), log };
}

function toggleHabit(state, habitId, key) {
  const ids = state.log[key] || [];
  const next = ids.includes(habitId) ? ids.filter((id) => id !== habitId) : [...ids, habitId];
  return { ...state, log: { ...state.log, [key]: next } };
}

function addTask(state, key, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Task text is required");
  const task = { id: newId(), text: trimmed.slice(0, 120), done: false };
  return { ...state, tasks: { ...state.tasks, [key]: [...(state.tasks[key] || []), task] } };
}

function updateTasks(state, key, fn) {
  return { ...state, tasks: { ...state.tasks, [key]: fn(state.tasks[key] || []) } };
}

function toggleTask(state, key, taskId) {
  return updateTasks(state, key, (list) => list.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)));
}

function removeTask(state, key, taskId) {
  return updateTasks(state, key, (list) => list.filter((t) => t.id !== taskId));
}

// Copies yesterday's unfinished tasks into `key`, skipping ones already there.
function copyUnfinishedFromYesterday(state, key) {
  const existing = new Set((state.tasks[key] || []).map((t) => t.text));
  const carried = (state.tasks[addDays(key, -1)] || [])
    .filter((t) => !t.done && !existing.has(t.text))
    .map((t) => ({ id: newId(), text: t.text, done: false }));
  return { state: updateTasks(state, key, (list) => [...list, ...carried]), count: carried.length };
}

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validates imported JSON before it replaces the app's data.
function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON");
  }
  if (!data || !Array.isArray(data.habits) || typeof data.log !== "object" || typeof data.tasks !== "object") {
    throw new Error("That file isn't a Daybreak backup");
  }
  const habits = data.habits.filter((h) => h && typeof h.id === "string" && typeof h.name === "string" && Array.isArray(h.days) && KEY_RE.test(h.createdAt));
  const log = Object.fromEntries(Object.entries(data.log).filter(([k, v]) => KEY_RE.test(k) && Array.isArray(v)));
  const tasks = Object.fromEntries(Object.entries(data.tasks).filter(([k, v]) => KEY_RE.test(k) && Array.isArray(v)));
  const theme = ["light", "dark", "system"].includes(data.theme) ? data.theme : "system";
  return { habits, log, tasks, theme };
}

const SUGGESTIONS = [
  { name: "Drink 8 glasses of water", emoji: "💧" },
  { name: "Walk 8,000 steps", emoji: "🚶" },
  { name: "Read 10 pages", emoji: "📖" },
  { name: "Meditate 5 minutes", emoji: "🧘" },
  { name: "No phone first hour", emoji: "📵" },
  { name: "Workout", emoji: "🏋️" },
  { name: "Sleep by 11pm", emoji: "🌙" },
  { name: "Journal 3 lines", emoji: "✍️" },
  { name: "Eat a vegetable", emoji: "🥦" },
  { name: "Learn something new", emoji: "🧠" },
  { name: "Tidy for 10 minutes", emoji: "🧹" },
  { name: "Call family or a friend", emoji: "📞" },
];

const DaybreakCore = {
  STATS_SHORT_DAYS, STATS_LONG_DAYS, SUGGESTIONS,
  toKey, fromKey, addDays, emptyState, isScheduled, isDone,
  currentStreak, bestStreak, completionRate, dayScore,
  addHabit, removeHabit, toggleHabit,
  addTask, toggleTask, removeTask, copyUnfinishedFromYesterday, parseImport,
};

if (typeof module !== "undefined") module.exports = DaybreakCore;
else globalThis.DaybreakCore = DaybreakCore;
