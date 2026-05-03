import fs from 'node:fs';
import path from 'node:path';

const OLLAMA_BASE_URL = 'http://localhost:11434';

export interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAvailableModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.models?.map((m: { name: string }) => m.name) ?? [];
  } catch {
    return [];
  }
}

export async function describeImage(imagePath: string): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llava:7b-v1.6-mistral-q4_K_M',
      prompt: 'Describe this image concisely in 2-3 sentences. Then list 5-10 keyword tags that describe the subject, style, mood, colors, and medium. Format tags as a comma-separated list on a new line starting with "Tags:"',
      images: [base64Image],
      stream: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
  }

  const data: OllamaGenerateResponse = await res.json();
  return data.response;
}

export function parseTagsFromDescription(description: string): string[] {
  const tagsMatch = description.match(/Tags?:\s*(.+)/i);
  if (!tagsMatch) {
    const words = description
      .toLowerCase()
      .split(/[\s,;.]+/)
      .filter((w) => w.length > 3 && w.length < 20)
      .slice(0, 8);
    return [...new Set(words)];
  }

  return tagsMatch[1]
    .split(/[,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1 && t.length < 30)
    .slice(0, 10);
}
