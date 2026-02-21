import { NextRequest, NextResponse } from "next/server";
import type { GenerateTeamResponse } from "@/types";

// Mock AI responses — replace with real OpenAI/Gemini SDK calls
const MOCK_CAR_NAMES = [
  "Apex Phantom",
  "Neon Viper",
  "Turbo Titan",
  "Cyber Blaze",
  "Iron Thunder",
  "Volt Storm",
];
const MOCK_SLOGANS = [
  "Faster than the speed of thought.",
  "Born from data. Built to dominate.",
  "No limits. No mercy. No brakes.",
  "Code to the metal.",
  "Engineered in the future.",
  "Raw power meets raw intelligence.",
];

// Placeholder car images (royalty-free, visually relevant)
const MOCK_CAR_IMAGES = [
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800&q=80",
  "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800&q=80",
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keywords: string[] = body.keywords ?? [];

    // TODO: Replace this mock with a real AI call, e.g.:
    // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // const completion = await openai.chat.completions.create({
    //   model: "gpt-4o",
    //   messages: [
    //     {
    //       role: "user",
    //       content: `Create a creative F1 racing team name and slogan using these keywords: ${keywords.join(", ")}.
    //                 Return JSON: { name: string, slogan: string }`,
    //     },
    //   ],
    // });
    // const { name, slogan } = JSON.parse(completion.choices[0].message.content ?? "{}");

    // Simulate AI processing delay
    await new Promise((r) => setTimeout(r, 1500));

    const response: GenerateTeamResponse = {
      name:
        keywords.length > 0
          ? `${keywords[0]} ${randomPick(["Racing", "Speed", "Force", "Circuit"])}`
          : randomPick(MOCK_CAR_NAMES),
      slogan: randomPick(MOCK_SLOGANS),
      imageUrl: randomPick(MOCK_CAR_IMAGES),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate team data." },
      { status: 500 }
    );
  }
}
