import path from "node:path";

export function getDataDirectory(): string {
  const configured = process.env.CONTENT_FACTORY_DATA_DIR?.trim();
  return path.resolve(configured || path.join(process.cwd(), "data"));
}

export function dataFilePath(...segments: string[]): string {
  return path.join(getDataDirectory(), ...segments);
}
