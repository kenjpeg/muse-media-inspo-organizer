import type Database from 'better-sqlite3';
import { describeImage, parseTagsFromDescription, isOllamaRunning } from './ollama-client';
import { createTagRepo } from '../database/repositories/tags';
import { createImageRepo } from '../database/repositories/images';

export async function autoTagImage(db: Database.Database, imageId: string): Promise<string[]> {
  const running = await isOllamaRunning();
  if (!running) return [];

  const imageRepo = createImageRepo(db);
  const tagRepo = createTagRepo(db);
  const image = imageRepo.getById(imageId);
  if (!image) return [];

  const imagePath = image.thumbnail_path || image.original_path;

  try {
    const description = await describeImage(imagePath);
    const tagNames = parseTagsFromDescription(description);

    const addedTags: string[] = [];
    for (const tagName of tagNames) {
      const tag = tagRepo.create(tagName);
      tagRepo.addToImage(imageId, tag.id, true, 0.8);
      addedTags.push(tagName);
    }

    if (description && !image.notes) {
      const notesLine = description.replace(/Tags?:\s*.+/i, '').trim();
      if (notesLine) {
        imageRepo.update(imageId, { notes: notesLine });
      }
    }

    return addedTags;
  } catch (err) {
    console.error('Auto-tag failed for', imageId, err);
    return [];
  }
}
