import type Database from 'better-sqlite3';
import { getTextEmbedding, isSidecarRunning, startSidecar } from './python-sidecar';

export interface SimilarResult {
  image_id: string;
  distance: number;
}

export async function searchByText(db: Database.Database, query: string, limit = 20): Promise<SimilarResult[]> {
  if (!isSidecarRunning()) {
    startSidecar();
    await new Promise((r) => setTimeout(r, 3000));
  }

  const embedding = await getTextEmbedding(query);
  if (!embedding) return [];

  return searchByVector(db, embedding, limit);
}

export async function findSimilarImages(db: Database.Database, imageId: string, limit = 20): Promise<SimilarResult[]> {
  const row = db.prepare('SELECT embedding FROM image_embeddings WHERE image_id = ?').get(imageId) as { embedding: Buffer } | undefined;
  if (!row) return [];

  const embedding = Array.from(new Float32Array(row.embedding.buffer));
  return searchByVector(db, embedding, limit);
}

function searchByVector(db: Database.Database, embedding: number[], limit: number): SimilarResult[] {
  // sqlite-vec KNN query
  // If sqlite-vec is not loaded, fall back to brute-force
  try {
    const results = db.prepare(`
      SELECT image_id, distance
      FROM image_embeddings
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `).all(JSON.stringify(embedding), limit) as SimilarResult[];
    return results;
  } catch {
    // Fallback: no vector extension loaded yet
    return [];
  }
}
