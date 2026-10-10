import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(3).max(1000),
  fixtures: z
    .array(z.object({ uid: z.string(), name: z.string(), fixture: z.string(), cct: z.boolean(), gm: z.boolean(), color: z.boolean() }))
    .min(1)
    .max(200),
});

export const generateLookFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { generateLook } = await import("./ai-look.server");
    try {
      return { ok: true as const, look: await generateLook(data.prompt, data.fixtures) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "AI request failed." };
    }
  });
