#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const [command, ...args] = process.argv.slice(2);
const dataDir = path.resolve(
  readOption(args, "data-dir")
    || process.env.CONTENT_FACTORY_DATA_DIR
    || path.join(process.cwd(), "data"),
);
const backupRoot = path.resolve(
  process.env.CONTENT_FACTORY_BACKUP_DIR || path.join(process.cwd(), "backups"),
);

try {
  if (command === "backup") await backup();
  else if (command === "restore") await restore();
  else if (command === "delete") await deleteData();
  else usage(1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

async function backup() {
  await access(dataDir);
  const destination = path.resolve(
    positional(args)[0]
      || readOption(args, "backup-dir")
      || path.join(backupRoot, `contentfactory-${timestamp()}`),
  );
  if (isInside(destination, dataDir)) throw new Error("备份目录不能放在数据目录内部。");
  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(destination, { recursive: false });
  await cp(dataDir, path.join(destination, "data"), { recursive: true, errorOnExist: true });
  const files = await hashDirectory(path.join(destination, "data"));
  await writeFile(path.join(destination, "manifest.json"), `${JSON.stringify({
    version: 1,
    createdAt: new Date().toISOString(),
    files,
  }, null, 2)}\n`, "utf8");
  console.log(`备份完成：${destination}`);
}

async function restore() {
  const source = positional(args)[0];
  if (!source) throw new Error("用法：npm run data:restore -- <备份目录> --confirm=RESTORE");
  if (readOption(args, "confirm") !== "RESTORE") throw new Error("恢复会替换当前数据，请添加 --confirm=RESTORE。");
  const backupDir = path.resolve(source);
  const manifest = JSON.parse(await readFile(path.join(backupDir, "manifest.json"), "utf8"));
  if (manifest.version !== 1 || !manifest.files || typeof manifest.files !== "object") {
    throw new Error("备份清单格式无效。");
  }
  const sourceData = path.join(backupDir, "data");
  const currentHashes = await hashDirectory(sourceData);
  if (JSON.stringify(currentHashes) !== JSON.stringify(manifest.files)) {
    throw new Error("备份校验失败，文件可能不完整或已被修改。");
  }

  const previous = `${dataDir}.pre-restore-${timestamp()}`;
  const exists = await pathExists(dataDir);
  if (exists) await rename(dataDir, previous);
  try {
    await mkdir(path.dirname(dataDir), { recursive: true });
    await cp(sourceData, dataDir, { recursive: true, errorOnExist: true });
  } catch (error) {
    await rm(dataDir, { recursive: true, force: true });
    if (exists) await rename(previous, dataDir);
    throw error;
  }
  console.log(`恢复完成：${dataDir}`);
  if (exists) console.log(`原数据保留在：${previous}`);
}

async function deleteData() {
  if (readOption(args, "confirm") !== "DELETE_CUSTOMER_DATA") {
    throw new Error("删除不可撤销，请添加 --confirm=DELETE_CUSTOMER_DATA。");
  }
  await rm(dataDir, { recursive: true, force: true });
  console.log(`客户数据已删除：${dataDir}`);
}

async function hashDirectory(directory) {
  const files = await listFiles(directory);
  const hashes = {};
  for (const file of files) {
    const relative = path.relative(directory, file).split(path.sep).join("/");
    hashes[relative] = createHash("sha256").update(await readFile(file)).digest("hex");
  }
  return hashes;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

function readOption(values, name) {
  const prefix = `--${name}=`;
  return values.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positional(values) {
  return values.filter((value) => !value.startsWith("--"));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function usage(code) {
  console.error([
    "内容工厂数据维护：",
    "  backup [备份目录] [--data-dir=/path/to/data]",
    "  restore <备份目录> --confirm=RESTORE [--data-dir=/path/to/data]",
    "  delete --confirm=DELETE_CUSTOMER_DATA [--data-dir=/path/to/data]",
    "执行备份和恢复前必须停止应用服务。",
  ].join("\n"));
  process.exit(code);
}
