import { useRef, useState, type SetStateAction } from 'react';
import type { PatchedFixture } from '@/lib/dmx';
import { fixtureEdit, restoreFixtureEdit, type FixtureEdit } from '@/lib/fixture-history';
export function useFixtureHistory(initial: PatchedFixture[]) {
  const [fixtures, render] = useState(initial);
  const current = useRef(initial);
  const past = useRef<FixtureEdit[]>([]), future = useRef<FixtureEdit[]>([]);
  const group = useRef<PatchedFixture[] | null>(null);
  const [, refresh] = useState(0);
  const record = (before: PatchedFixture[], after: PatchedFixture[]) => {
    const edit = fixtureEdit(before, after);
    if (!edit.length) return;
    past.current = [...past.current.slice(-99), edit];
    future.current = [];
    refresh((n) => n + 1);
  };
  const set = (value: SetStateAction<PatchedFixture[]>, tracked = true) => {
    const before = current.current;
    const next = typeof value === 'function' ? value(before) : value;
    current.current = next;
    if (tracked && !group.current) record(before, next);
    render(next);
  };
  const end = () => {
    const before = group.current;
    group.current = null;
    if (before) record(before, current.current);
  };
  const move = (direction: 'before' | 'after') => {
    end();
    const source = direction === 'before' ? past : future;
    const target = direction === 'before' ? future : past;
    const edit = source.current.pop();
    if (!edit) return;
    target.current.push(edit);
    set(restoreFixtureEdit(current.current, edit, direction), false);
    refresh((n) => n + 1);
  };
  return { fixtures, setFixtures: (value: SetStateAction<PatchedFixture[]>) => set(value),
    setUntrackedFixtures: (value: SetStateAction<PatchedFixture[]>) => set(value, false),
    begin: () => { if (!group.current) group.current = current.current; }, end,
    undo: () => move('before'), redo: () => move('after'),
    canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}
