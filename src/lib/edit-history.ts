export function editHistory<T>(limit = 60) {
  const past: T[] = [], future: T[] = [];
  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    push(value: T) { past.push(structuredClone(value)); if (past.length > limit) past.shift(); future.length = 0; },
    undo(current: T) { const value = past.pop(); if (value === undefined) return; future.push(structuredClone(current)); return value; },
    redo(current: T) { const value = future.pop(); if (value === undefined) return; past.push(structuredClone(current)); return value; },
  };
}