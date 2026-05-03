import type Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  color: string | null;
  created_at: string;
  updated_at: string;
  image_count?: number;
}

export function createFolderRepo(db: Database.Database) {
  const getAllStmt = db.prepare(`
    SELECT f.*, COUNT(i.id) as image_count
    FROM folders f
    LEFT JOIN images i ON i.folder_id = f.id AND i.is_trashed = 0
    GROUP BY f.id
    ORDER BY f.sort_order
  `);

  const getByIdStmt = db.prepare('SELECT * FROM folders WHERE id = ?');

  const insertStmt = db.prepare(`
    INSERT INTO folders (id, name, parent_id, sort_order, color)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE folders SET name = ?, parent_id = ?, sort_order = ?, color = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const deleteStmt = db.prepare('DELETE FROM folders WHERE id = ?');

  return {
    getAll(): Folder[] {
      return getAllStmt.all() as Folder[];
    },

    getById(id: string): Folder | undefined {
      return getByIdStmt.get(id) as Folder | undefined;
    },

    create(name: string, parentId: string | null = null): Folder {
      const id = uuid();
      const maxOrder = db.prepare(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM folders WHERE parent_id IS ?'
      ).get(parentId) as { next: number };

      insertStmt.run(id, name, parentId, maxOrder.next, null);
      return getByIdStmt.get(id) as Folder;
    },

    update(id: string, data: Partial<Pick<Folder, 'name' | 'parent_id' | 'sort_order' | 'color'>>): Folder {
      const existing = getByIdStmt.get(id) as Folder;
      updateStmt.run(
        data.name ?? existing.name,
        data.parent_id !== undefined ? data.parent_id : existing.parent_id,
        data.sort_order ?? existing.sort_order,
        data.color !== undefined ? data.color : existing.color,
        id
      );
      return getByIdStmt.get(id) as Folder;
    },

    delete(id: string): void {
      deleteStmt.run(id);
    },
  };
}
