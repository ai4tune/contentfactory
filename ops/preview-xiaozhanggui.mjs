// 只复用模型配置；不继承生产数据库、账户、知识源或数据目录。
import { spawn } from "node:child_process";
import { readFile, mkdtemp, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";
import { setTimeout as delay } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "..");
const { values } = parseArgs({ options: { env: { type: "string" }, "data-dir": { type: "string" }, port: { type: "string", default: "4481" } } });
if (!values.env) throw new Error("请通过 --env 指定已有模型配置文件。");
const configured = parseEnv(await readFile(path.resolve(values.env), "utf8"));
const modelKeys = ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "AI_REQUEST_TIMEOUT_MS", "AI_INPUT_COST_PER_1M", "AI_OUTPUT_COST_PER_1M", "IMAGE_BASE_URL", "IMAGE_API_KEY", "IMAGE_MODEL", "VISION_BASE_URL", "VISION_API_KEY", "VISION_MODEL"];
const modelEnv = Object.fromEntries(modelKeys.filter((key) => configured[key]).map((key) => [key, configured[key]]));
for (const key of ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL"]) if (!modelEnv[key]) throw new Error(`${key} 尚未配置。`);
const endpoint = new URL(modelEnv.AI_BASE_URL);
if (["localhost", "127.0.0.1", "::1"].includes(endpoint.hostname) || /mock|synthetic/i.test(modelEnv.AI_MODEL)) throw new Error("此预览需要真实 AI，不能使用模拟网关。");
const directory = values["data-dir"] ? path.resolve(values["data-dir"]) : await mkdtemp(path.join(tmpdir(), "xiaozhanggui-real-preview-"));
if (!directory.startsWith(path.resolve(tmpdir()) + path.sep) || !/^xiaozhanggui-(browser|real-preview)-/.test(path.basename(directory))) throw new Error("只能使用小掌柜专用的本地临时测试目录。");
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SUPABASE|CONTENT_FACTORY|AI_|IMAGE_|VISION_|FEISHU|WORKFLOW_/.test(key)));
for (const [source, target] of [["public", ".next/standalone/public"], [".next/static", ".next/standalone/.next/static"]]) await cp(path.join(root, source), path.join(root, target), { recursive: true });
const child = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], { cwd: root, env: {
  ...environment, ...modelEnv, HOSTNAME: "127.0.0.1", PORT: values.port,
  CONTENT_FACTORY_DATA_DIR: directory, CONTENT_FACTORY_ACCESS_USER: "starter", CONTENT_FACTORY_ACCESS_CODE: "test-code", CONTENT_FACTORY_PREVIEW_MODE: "real_ai",
  NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "", SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", CONTENT_FACTORY_WORKSPACE_ID: "",
  WORKFLOW_TARGET_WORLD: "local", WORKFLOW_LOCAL_DATA_DIR: path.join(directory, "workflow"), WORKFLOW_LOCAL_BASE_URL: `http://127.0.0.1:${values.port}`,
}, stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", (chunk) => process.stdout.write(chunk));
// 服务端错误仅输出本地诊断；不打印环境配置。
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
process.once("SIGTERM", () => child.kill("SIGTERM"));
process.once("SIGINT", () => child.kill("SIGTERM"));
child.once("exit", (code) => { process.exitCode = code ?? 0; });
for (let index = 0; index < 100; index++) {
  if (child.exitCode !== null) throw new Error("本地预览启动失败。");
  try {
    if ((await fetch(`http://127.0.0.1:${values.port}/api/health`)).ok) {
      console.log(`真实 AI 本地预览：http://127.0.0.1:${values.port}/setup；模型：${modelEnv.AI_MODEL}；数据目录：${directory}`);
      break;
    }
  } catch { /* 仅等待本地服务器就绪。 */ }
  if (index === 99) { child.kill("SIGTERM"); throw new Error("本地预览启动超时。"); }
  await delay(100);
}
