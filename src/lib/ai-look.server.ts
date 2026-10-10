import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";

const LookSchema = z.object({
  summary: z.string(),
  fixtures: z.array(
    z.object({
      uid: z.string(),
      intensity: z.number(),
      kelvin: z.number().nullable(),
      gm: z.number().nullable(),
      hue: z.number().nullable(),
      saturation: z.number().nullable(),
      crossfade: z.number().nullable(),
      effect: z.enum(["none", "pulse", "strobe", "fire", "candle", "tv", "lightning"]),
      effectRate: z.number().nullable(),
      effectLow: z.number().nullable(),
      effectHigh: z.number().nullable(),
    }),
  ),
});
export type LookResult = z.infer<typeof LookSchema>;

export interface LookFixtureInput {
  uid: string;
  name: string;
  fixture: string;
  cct: boolean;
  gm: boolean;
  color: boolean;
}

const INSTRUCTIONS = `You are a film gaffer programming a DMX lighting console.
Given a description of a desired look and a list of patched fixtures with their capabilities, return settings for EVERY fixture (use the exact uid).
- intensity: 0-100 percent.
- kelvin: 2000-10000, or null if the fixture has no CCT control.
- gm: -1 (full minus green/magenta) to +1 (full plus green), 0 neutral; null if no G/M control.
- hue 0-360, saturation 0-100, crossfade 0-100 (0 = pure CCT white, 100 = pure HSI colour); all null if the fixture has no colour.
- effect: "none" unless the look calls for movement (fire, candle, tv, lightning storm, police pulse, strobe...). effectRate in Hz (0.05-10), effectLow/effectHigh 0-100 percent; null when effect is none.
Use fixture names as hints for their role (key, fill, back, practical...). Keep a short summary (one sentence) of the look.`;

export async function generateLook(prompt: string, fixtures: LookFixtureInput[]): Promise<LookResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `Look: ${prompt}\n\nFixtures:\n${fixtures
          .map((f) => `- uid=${f.uid} | ${f.name} | ${f.fixture} | cct:${f.cct} gm:${f.gm} colour:${f.color}`)
          .join("\n")}`,
      },
    ],
    output: Output.object({ schema: LookSchema }),
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return await result.output;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) throw new Error("The AI returned an unreadable answer. Try rephrasing the look.");
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 402) throw new Error("AI credits are used up. Add credits in your workspace to keep generating looks.");
    if (status === 429) throw new Error("Too many requests right now — wait a moment and try again.");
    if (status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error("AI request failed. Please try again.");
  }
}
