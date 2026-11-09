import assert from "node:assert/strict";
import test from "node:test";
import {
  applyHabitPatches,
  habitPatchMatches,
  isOpenHabit,
} from "./habit-overrides.js";

const water = {
  id: "water",
  title: "Drink water",
  completed: false,
  status: "open",
};

test("skip stays hidden when a refresh still lists the habit as open", () => {
  const patches = {
    water: { completed: false, status: "skipped" },
  };
  const shown = applyHabitPatches([water], patches);
  assert.equal(isOpenHabit(shown[0]), false);
  assert.equal(shown[0].status, "skipped");
});

test("check stays hidden when a refresh still lists the habit as open", () => {
  const patches = {
    water: { completed: true, status: "open" },
  };
  const shown = applyHabitPatches([water], patches);
  assert.equal(shown[0].completed, true);
  assert.equal(isOpenHabit(shown[0]), false);
});

test("a later stale list cannot bring a resolved habit back", () => {
  const patches = {
    water: { completed: false, status: "skipped" },
  };
  const fresh = applyHabitPatches(
    [{ ...water, status: "skipped" }],
    patches,
  );
  assert.equal(habitPatchMatches(fresh[0], patches.water), true);
  assert.equal(fresh[0], fresh[0]);

  const stale = applyHabitPatches([water], patches);
  assert.equal(stale[0].status, "skipped");
  assert.equal(isOpenHabit(stale[0]), false);
});

test("an earlier habit's refresh does not uncover a later check", () => {
  const open = [
    water,
    { id: "journal", title: "Journal", completed: false, status: "open" },
  ];
  const patches = {
    water: { completed: true, status: "open" },
    journal: { completed: false, status: "skipped" },
  };
  const afterWaterOnly = open.map((item) =>
    item.id === "water" ? { ...item, completed: true } : item,
  );

  const shown = applyHabitPatches(afterWaterOnly, patches);
  assert.equal(isOpenHabit(shown.find((item) => item.id === "water")), false);
  assert.equal(shown.find((item) => item.id === "journal").status, "skipped");
});

test("leaves unrelated habits and already-matching rows untouched", () => {
  const patches = { water: { completed: true, status: "open" } };
  const done = { ...water, completed: true };
  const same = applyHabitPatches([done], patches);
  assert.equal(same[0], done);

  const other = {
    id: "journal",
    title: "Journal",
    completed: false,
    status: "open",
  };
  const withOther = applyHabitPatches([other], patches);
  assert.equal(withOther[0], other);

  const original = [water];
  assert.equal(applyHabitPatches(original, {}), original);
  assert.equal(applyHabitPatches(original, null), original);
});
