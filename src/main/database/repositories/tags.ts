import type Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

export interface Tag {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
  image_count?: number;
}

export function createTagRepo(db: Database.Database) {
  const getAllStmt = db.prepare(`
    SELECT t.*, COUNT(it.image_id) as image_count
    FROM tags t
    LEFT JOIN image_tags it ON it.tag_id = t.id
    LEFT JOIN images i ON i.id = it.image_id AND i.is_trashed = 0
    GROUP BY t.id
    ORDER BY t.name
  `);

  const getByIdStmt = db.prepare('SELECT * FROM tags WHERE id = ?');
  const getByNameStmt = db.prepare('SELECT * FROM tags WHERE name = ?');
  const insertStmt = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)');
  const deleteStmt = db.prepare('DELETE FROM tags WHERE id = ?');

  const addTagToImageStmt = db.prepare(`
    INSERT OR IGNORE INTO image_tags (image_id, tag_id, is_auto, confidence) VALUES (?, ?, ?, ?)
  `);
  const removeTagFromImageStmt = db.prepare('DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?');

  const getTagsForImageStmt = db.prepare(`
    SELECT t.*, it.is_auto, it.confidence
    FROM tags t
    JOIN image_tags it ON it.tag_id = t.id
    WHERE it.image_id = ?
    ORDER BY t.name
  `);

  return {
    getAll(): Tag[] {
      const all = getAllStmt.all() as Tag[];
      const toDelete = all.filter((t) => (t.image_count ?? 0) === 0);
      for (const t of toDelete) {
        deleteStmt.run(t.id);
      }
      return all.filter((t) => (t.image_count ?? 0) > 0);
    },

    getById(id: string): Tag | undefined {
      return getByIdStmt.get(id) as Tag | undefined;
    },

    create(name: string, color: string | null = null): Tag {
      const existing = getByNameStmt.get(name) as Tag | undefined;
      if (existing) return existing;
      const id = uuid();
      insertStmt.run(id, name, color);
      return getByIdStmt.get(id) as Tag;
    },

    delete(id: string): void {
      deleteStmt.run(id);
    },

    addToImage(imageId: string, tagId: string, isAuto = false, confidence: number | null = null): void {
      addTagToImageStmt.run(imageId, tagId, isAuto ? 1 : 0, confidence);
    },

    removeFromImage(imageId: string, tagId: string): void {
      removeTagFromImageStmt.run(imageId, tagId);
      const remaining = db.prepare('SELECT COUNT(*) as count FROM image_tags WHERE tag_id = ?').get(tagId) as { count: number };
      if (remaining.count === 0) {
        deleteStmt.run(tagId);
      }
    },

    getForImage(imageId: string): (Tag & { is_auto: number; confidence: number | null })[] {
      return getTagsForImageStmt.all(imageId) as (Tag & { is_auto: number; confidence: number | null })[];
    },

    getTotalCount(): number {
      const result = db.prepare('SELECT COUNT(*) as total FROM tags').get() as { total: number };
      return result.total;
    },
  };
}
