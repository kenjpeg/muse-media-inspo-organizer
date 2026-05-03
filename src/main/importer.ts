import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import type Database from 'better-sqlite3';
import { createImageRepo } from './database/repositories/images';
import { getLibraryPath } from './database/connection';

export interface ImportResult {
  id: string;
  filename: string;
  thumbnail_path: string;
  success: boolean;
  error?: string;
  duplicate?: boolean;
}

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.tiff', '.tif', '.bmp',
]);

export function isSupported(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function computeHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function getImageDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const metadata = await sharp(filePath).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
  } catch {
    // SVG or unsupported format
  }
  return null;
}

async function generateThumbnail(sourcePath: string, destPath: string): Promise<void> {
  await sharp(sourcePath)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(destPath);
}

export async function importFile(
  db: Database.Database,
  filePath: string,
  folderId: string | null = null
): Promise<ImportResult> {
  const filename = path.basename(filePath);

  if (!isSupported(filePath)) {
    return { id: '', filename, thumbnail_path: '', success: false, error: 'Unsupported file type' };
  }

  try {
    const hash = computeHash(filePath);
    const imageRepo = createImageRepo(db);
    const existing = imageRepo.getByHash(hash);

    if (existing) {
      return { id: existing.id, filename, thumbnail_path: '', success: false, duplicate: true };
    }

    const libraryPath = getLibraryPath();
    const ext = path.extname(filePath);
    const destFilename = `${hash}${ext}`;
    const destPath = path.join(libraryPath, 'originals', destFilename);

    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(filePath, destPath);
    }

    const thumbFilename = `${hash}.webp`;
    const thumbPath = path.join(libraryPath, 'thumbnails', thumbFilename);

    try {
      await generateThumbnail(destPath, thumbPath);
    } catch {
      // If thumbnail generation fails (e.g., SVG), use original
    }

    const dimensions = await getImageDimensions(destPath);
    const stats = fs.statSync(filePath);
    const fileType = ext.replace('.', '').toLowerCase();

    const image = imageRepo.create({
      filename,
      original_path: destPath,
      thumbnail_path: fs.existsSync(thumbPath) ? thumbPath : null,
      title: path.basename(filename, ext),
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      file_size: stats.size,
      file_type: fileType,
      hash,
      folder_id: folderId,
      file_created_at: stats.birthtime.toISOString(),
      file_modified_at: stats.mtime.toISOString(),
    });

    return { id: image.id, filename, thumbnail_path: thumbPath, success: true };
  } catch (err) {
    return { id: '', filename, thumbnail_path: '', success: false, error: String(err) };
  }
}

export async function importFiles(
  db: Database.Database,
  filePaths: string[],
  folderId: string | null = null
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];
  for (const filePath of filePaths) {
    const result = await importFile(db, filePath, folderId);
    results.push(result);
  }
  return results;
}
