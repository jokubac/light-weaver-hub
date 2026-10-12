import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useFixtureHistory } from '@/hooks/use-fixture-history';
import type { PatchedFixture } from '@/lib/dmx';

it('groups a fader gesture, clears redo after a new edit and ignores output updates', () => {
  const f = { uid: 'a', intensity: 0.2, fx: { kind: 'none' } } as PatchedFixture;
  const { result } = renderHook(() => useFixtureHistory([f]));
  act(() => {
    result.current.begin();
    result.current.setFixtures([{ ...f, intensity: 0.4 }]);
    result.current.setFixtures([{ ...f, intensity: 0.8 }]);
    result.current.end();
  });
  act(() => result.current.undo());
  expect(result.current.fixtures[0]?.intensity).toBe(0.2);
  expect(result.current.canUndo).toBe(false);
  act(() => result.current.redo());
  expect(result.current.fixtures[0]?.intensity).toBe(0.8);
  act(() => result.current.undo());
  act(() => result.current.setFixtures([{ ...f, intensity: 0.5 }]));
  expect(result.current.canRedo).toBe(false);
  act(() => result.current.setUntrackedFixtures([{ ...f, intensity: 0.7 }]));
  act(() => result.current.undo());
  expect(result.current.fixtures[0]?.intensity).toBe(0.2);
  expect(result.current.canUndo).toBe(false);
});