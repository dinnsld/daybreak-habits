const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("./core.js");

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const START = "2026-11-01"; // a Sunday

function withHabit(days = EVERY_DAY) {
  const state = C.addHabit(C.emptyState(), { name: "Read", days }, START);
  return { state, habit: state.habits[0] };
}

function doneOn(state, habit, keys) {
  return keys.reduce((s, k) => C.toggleHabit(s, habit.id, k), state);
}

test("date helpers round-trip and cross month ends", () => {
  assert.equal(C.addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(C.addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(C.toKey(C.fromKey("2026-11-11")), "2026-11-11");
});

test("addHabit validates input and does not mutate state", () => {
  const empty = C.emptyState();
  assert.throws(() => C.addHabit(empty, { name: "  ", days: EVERY_DAY }, START), /name/);
  assert.throws(() => C.addHabit(empty, { name: "x", days: [] }, START), /day/);
  const next = C.addHabit(empty, { name: " Run ", days: EVERY_DAY }, START);
  assert.equal(empty.habits.length, 0);
  assert.equal(next.habits[0].name, "Run");
});

test("isScheduled respects weekdays and creation date", () => {
  const { habit } = withHabit([1, 3, 5]);
  assert.equal(C.isScheduled(habit, "2026-11-02"), true); // Monday
  assert.equal(C.isScheduled(habit, "2026-11-03"), false); // Tuesday
  assert.equal(C.isScheduled(habit, "2026-10-26"), false); // before creation
});

test("toggleHabit flips done state immutably", () => {
  const { state, habit } = withHabit();
  const on = C.toggleHabit(state, habit.id, START);
  assert.equal(C.isDone(on, habit.id, START), true);
  assert.equal(C.isDone(state, habit.id, START), false);
  assert.equal(C.isDone(C.toggleHabit(on, habit.id, START), habit.id, START), false);
});

test("currentStreak counts back and ignores an unfinished today", () => {
  const { state, habit } = withHabit();
  const s = doneOn(state, habit, ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.equal(C.currentStreak(s, habit, "2026-11-03"), 3);
  assert.equal(C.currentStreak(s, habit, "2026-11-04"), 3); // today not done yet
  assert.equal(C.currentStreak(s, habit, "2026-11-05"), 0); // missed yesterday
});

test("currentStreak skips unscheduled days", () => {
  const { state, habit } = withHabit([1, 3, 5]);
  const s = doneOn(state, habit, ["2026-11-02", "2026-11-04", "2026-11-06"]);
  assert.equal(C.currentStreak(s, habit, "2026-11-08"), 3);
});

test("bestStreak finds the longest run", () => {
  const { state, habit } = withHabit();
  const s = doneOn(state, habit, ["2026-11-01", "2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06"]);
  assert.equal(C.bestStreak(s, habit, "2026-11-10"), 3);
});

test("completionRate and dayScore", () => {
  const { state, habit } = withHabit();
  const s = doneOn(state, habit, ["2026-11-06", "2026-11-07"]);
  assert.equal(C.completionRate(s, "2026-11-07", 4), 0.5);
  assert.equal(C.completionRate(C.emptyState(), "2026-11-07", 7), 0);
  assert.equal(C.dayScore(s, "2026-11-07"), 1);
  assert.equal(C.dayScore(C.emptyState(), "2026-11-07"), null);
});

test("removeHabit drops habit and its log entries", () => {
  const { state, habit } = withHabit();
  const s = C.removeHabit(C.toggleHabit(state, habit.id, START), habit.id);
  assert.equal(s.habits.length, 0);
  assert.deepEqual(s.log[START], []);
});

test("tasks: add, toggle, remove, and reject blanks", () => {
  let s = C.addTask(C.emptyState(), START, "Email bank");
  const id = s.tasks[START][0].id;
  s = C.toggleTask(s, START, id);
  assert.equal(s.tasks[START][0].done, true);
  assert.equal(C.removeTask(s, START, id).tasks[START].length, 0);
  assert.throws(() => C.addTask(s, START, "   "), /required/);
});

test("copyUnfinishedFromYesterday carries only open, non-duplicate tasks", () => {
  let s = C.addTask(C.emptyState(), "2026-11-10", "A");
  s = C.addTask(s, "2026-11-10", "B");
  s = C.addTask(s, "2026-11-10", "C");
  s = C.toggleTask(s, "2026-11-10", s.tasks["2026-11-10"][1].id); // B done
  s = C.addTask(s, "2026-11-11", "C"); // already present today
  const { state, count } = C.copyUnfinishedFromYesterday(s, "2026-11-11");
  assert.equal(count, 1);
  assert.deepEqual(state.tasks["2026-11-11"].map((t) => t.text), ["C", "A"]);
});

test("parseImport validates and filters bad data", () => {
  assert.throws(() => C.parseImport("not json"), /valid JSON/);
  assert.throws(() => C.parseImport("{}"), /backup/);
  const raw = JSON.stringify({
    habits: [{ id: "a", name: "Ok", days: [1], createdAt: START }, { id: 5, name: "bad" }],
    log: { [START]: ["a"], nope: ["a"] },
    tasks: {},
    theme: "neon",
  });
  const s = C.parseImport(raw);
  assert.equal(s.habits.length, 1);
  assert.deepEqual(Object.keys(s.log), [START]);
  assert.equal(s.theme, "system");
});
