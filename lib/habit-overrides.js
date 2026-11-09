/**
 * Check and skip updates that must survive a stale list refresh.
 * useOptimistic drops when its transition ends, and a slower refresh for an
 * earlier habit can land last with the old open row. These patches stay put
 * until the server list shows the same result, and they reapply if a stale
 * payload arrives after a fresh one.
 */

export function isOpenHabit(item) {
  return !item.completed && item.status === "open";
}

export function habitPatchMatches(item, patch) {
  if (!item || !patch) return false;
  if (patch.status === "skipped") return item.status === "skipped";
  if (patch.status === "incomplete") return item.status === "incomplete";
  if (patch.completed) return Boolean(item.completed);
  return !item.completed && item.status === "open";
}

export function applyHabitPatches(items, patches) {
  if (!patches) return items;
  const ids = Object.keys(patches);
  if (ids.length === 0) return items;

  let changed = false;
  const next = items.map((item) => {
    const patch = patches[item.id];
    if (!patch || habitPatchMatches(item, patch)) return item;
    changed = true;
    return {
      ...item,
      completed: Boolean(patch.completed),
      status: patch.status,
    };
  });
  return changed ? next : items;
}
