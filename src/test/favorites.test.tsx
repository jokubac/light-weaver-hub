import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { favoritesFirst, useFavorites } from "@/lib/favorites";
import { fixtureWatts } from "@/lib/power";

beforeEach(() => localStorage.clear());
describe("favourites", () => {
  it("stars manufacturers without losing existing fixture favourites", () => {
    localStorage.setItem("crmx-console-favorites-v1", JSON.stringify({ fixtures: ["titan"] }));
    const { result } = renderHook(() => useFavorites("manufacturers"));
    act(() => result.current.toggle("Godox"));
    expect(result.current.list).toEqual(["Godox"]);
    expect(JSON.parse(localStorage.getItem("crmx-console-favorites-v1") ?? "{}").fixtures).toEqual(["titan"]);
  });
  it("puts favourites first without rearranging the rest", () => {
    expect(favoritesFirst(["ARRI", "Astera", "Godox"], (b) => b === "Godox")).toEqual(["Godox", "ARRI", "Astera"]);
  });
  it("never invents watts for an unknown fixture", () => {
    expect(fixtureWatts("Mystery RGB")).toBe(0);
    expect(fixtureWatts("Godox Knowled AM1600R")).toBe(0);
  });
});