import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const updateQueues = new Map<string, Promise<unknown>>();

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

export async function updateJsonFile<T>(
  filePath: string,
  fallback: T,
  update: (current: T) => T | Promise<T>,
): Promise<T> {
  const previous = updateQueues.get(filePath) ?? Promise.resolve();
  const next = previous.then(async () => {
    const current = await readJsonFile(filePath, fallback);
    const updated = await update(current);

    await writeJsonFileAtomic(filePath, updated);
    return updated;
  });

  const queued = next.catch(() => undefined);
  updateQueues.set(filePath, queued);

  try {
    return await next;
  } finally {
    if (updateQueues.get(filePath) === queued) {
      updateQueues.delete(filePath);
    }
  }
}

async function writeJsonFileAtomic(filePath: string, value: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
