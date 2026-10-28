/** 环境变量与运行配置。Node 20.12+ 原生 process.loadEnvFile，无需 dotenv。 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const KNOWLEDGE_DIR = path.join(PROJECT_ROOT, "data", "knowledge");

function loadEnvFiles(): void {
  // 项目 .env 优先，随后向上最多 3 层查找仓库根的 .env；不覆盖已存在的进程变量
  const candidates = [path.join(PROJECT_ROOT, ".env")];
  let dir = PROJECT_ROOT;
  for (let i = 0; i < 3; i += 1) {
    dir = path.dirname(dir);
    candidates.push(path.join(dir, ".env"));
  }
  for (const file of candidates) {
    try {
      process.loadEnvFile(file);
    } catch {
      // 文件不存在或不可读时跳过
    }
  }
}

loadEnvFiles();

export interface Settings {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  maxSteps: number;
  verbose: boolean;
}

export function resolveBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  // Anthropic 兼容路径不提供 /chat/completions，回退到官方 OpenAI 兼容地址
  if (trimmed.includes("/anthropic")) {
    return "https://api.deepseek.com";
  }
  return trimmed;
}

export function loadSettings(): Settings {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseUrl: resolveBaseUrl(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    maxSteps: Number(process.env.AGENT_MAX_STEPS ?? "8") || 8,
    verbose: process.env.AGENT_VERBOSE === "1",
  };
}
