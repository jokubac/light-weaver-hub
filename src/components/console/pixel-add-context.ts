import { createContext } from "react";

/**
 * Set by PixelStage so the "Add fixtures" picker can close its own dialog the
 * moment the chosen lights land on the map.
 */
export const PixelAddClose = createContext<() => void>(() => {});
