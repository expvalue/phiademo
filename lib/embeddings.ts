import crypto from "crypto";

const EMBEDDING_DIMENSION = 1536;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return deterministicEmbedding(text);
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input: text,
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"
    })
  });

  if (!response.ok) {
    return deterministicEmbedding(text);
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

export function deterministicEmbedding(text: string, dimension = EMBEDDING_DIMENSION): number[] {
  const hash = crypto.createHash("sha256").update(text).digest();
  let seed = hash.readUInt32BE(0);
  const result: number[] = [];
  for (let i = 0; i < dimension; i += 1) {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    const value = seed / 4294967296;
    result.push(value * 2 - 1);
  }
  return result;
}

export function formatVector(vector: number[]) {
  return `[${vector.map((value) => value.toFixed(6)).join(",")}]`;
}

export function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
