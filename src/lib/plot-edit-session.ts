/** Shared by plot mounts, but never persisted into a saved project. */
export function createPlotEditSession() {
  let unlocked = false;
  return {
    isUnlocked: () => unlocked,
    request: (approve: () => boolean) => {
      if (!unlocked) unlocked = approve();
      return unlocked;
    },
  };
}

export const plotEditSession = createPlotEditSession();