import { Vibrant } from 'node-vibrant/node';
import type Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';

export interface ExtractedColor {
  hex_color: string;
  percentage: number;
}

export async function extractColors(imagePath: string): Promise<ExtractedColor[]> {
  try {
    const palette = await Vibrant.from(imagePath).getPalette();
    const colors: ExtractedColor[] = [];

    const swatches = [
      palette.Vibrant,
      palette.DarkVibrant,
      palette.LightVibrant,
      palette.Muted,
      palette.DarkMuted,
      palette.LightMuted,
    ].filter(Boolean);

    const totalPopulation = swatches.reduce((sum, s) => sum + (s?.population ?? 0), 0);

    for (const swatch of swatches) {
      if (swatch) {
        colors.push({
          hex_color: swatch.hex,
          percentage: totalPopulation > 0 ? swatch.population / totalPopulation : 0,
        });
      }
    }

    return colors.sort((a, b) => b.percentage - a.percentage).slice(0, 6);
  } catch {
    return [];
  }
}

export async function extractAndStoreColors(db: Database.Database, imageId: string, imagePath: string): Promise<void> {
  const colors = await extractColors(imagePath);

  const insertStmt = db.prepare(
    'INSERT INTO image_colors (id, image_id, hex_color, percentage, sort_order) VALUES (?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((colors: ExtractedColor[]) => {
    db.prepare('DELETE FROM image_colors WHERE image_id = ?').run(imageId);
    colors.forEach((color, index) => {
      insertStmt.run(uuid(), imageId, color.hex_color, color.percentage, index);
    });
  });

  insertMany(colors);
}
