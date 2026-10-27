import { describe, it, expect } from "vitest";
import { LANGS, t, setLang, getLang, isRtl } from "./i18n";

describe("i18n", () => {
  it("offers every requested language plus English", () => {
    const codes = LANGS.map((l) => l.code);
    for (const c of ["en","lt","de","fr","es","it","pt","nl","pl","uk","cs","lv","et","sv","nb","ru","tr","zh","ja","ko","hi","bn","ar","vi"]) {
      expect(codes).toContain(c);
    }
    expect(codes).toHaveLength(24);
  });

  it("falls back to English for missing translations", () => {
    expect(t("Definitely not translated key 12345")).toBe("Definitely not translated key 12345");
  });

  it("switches to Lithuanian and back", async () => {
    await setLang("lt");
    expect(getLang()).toBe("lt");
    expect(t("Add fixtures")).toBe("Pridėti įrenginius");
    await setLang("en");
    expect(getLang()).toBe("en");
    expect(t("Add fixtures")).toBe("Add fixtures");
  });

  it("marks Arabic right-to-left", () => {
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("lt")).toBe(false);
  });
});
