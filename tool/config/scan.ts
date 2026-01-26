import { readdir, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ConfigFile, ConfigState } from "./types.ts";

export async function scanConfigDir(
  dirPath: string,
  filter?: string
): Promise<ConfigFile[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const configs: ConfigFile[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const filename = entry.name;

      if (!applyConfigFilter(filename, filter)) {
        continue;
      }

      const filePath = join(dirPath, filename);
      const state = determineConfigState(filename);

      let size: number | undefined;
      try {
        const stats = await stat(filePath);
        size = stats.size;
      } catch {
        size = undefined;
      }

      configs.push({
        name: filename,
        path: filePath,
        state,
        size,
      });
    }

    return configs.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirPath, { recursive: true });
      return [];
    }
    throw error;
  }
}

export function determineConfigState(filename: string): ConfigState {
  if (filename.endsWith(".disabled")) {
    return "excluded";
  }
  return "included";
}

export function applyConfigFilter(
  filename: string,
  pattern?: string
): boolean {
  if (!pattern) {
    return true;
  }

  try {
    const regex = new RegExp(pattern);
    return regex.test(filename);
  } catch {
    return false;
  }
}
