/** 智能工单处理平台 Agent 入口（pi SDK 版）。
 *
 * 用法：
 *     npm start                        # 交互模式
 *     npm start "查询订单 ORD-20261001"  # 单轮问答
 *     npm start -- --demo              # 跑内置业务场景
 *     npm start -- --verbose           # 打印关键事件
 *     npm start -- --show-tools        # 查看模型可见的工具 schema
 */

import readline from "node:readline/promises";
import { KNOWLEDGE_DIR, loadSettings, type Settings } from "./config.js";
import { createDeepSeekModels } from "./model.js";
import { KnowledgeBase } from "./rag.js";
import { TicketAgent, type RunResult } from "./agent.js";
import { buildTools, describeToolsJson } from "./tools/index.js";

const DEMO_QUESTIONS = [
  "你好，我 10 月 20 日买的无线降噪耳机 Pro，订单号 ORD-20261001，物流好几天没更新，帮我查一下订单详情和退款进度。",
  "无线降噪耳机 Pro 怎么和手机配对？一直连不上。",
  "登录 App 一直报 500 错误，已经两天了，帮我登记系统故障，平台 Android，版本 6.2.1。",
  "我要投诉客服态度太差，订单 ORD-20261002 的退款问题一直没人处理，希望尽快解决。",
];

const BANNER = `============================================================
 智能工单处理平台 · Agent Demo（pi SDK 版）
 能力：意图识别 / 订单查询 / 退款查询 / 产品咨询(RAG)
       系统故障登记 / 用户投诉
 命令：输入问题开始；demo 跑示例；help 帮助；exit 退出
============================================================`;

export function buildTicketAgent(settings: Settings, verbose: boolean): TicketAgent {
  if (!settings.apiKey) {
    throw new Error("未找到 DEEPSEEK_API_KEY，请配置环境变量或项目 .env");
  }
  const knowledgeBase = KnowledgeBase.load(KNOWLEDGE_DIR);
  const tools = buildTools(knowledgeBase);
  const { models, model } = createDeepSeekModels(settings);
  return new TicketAgent({
    model,
    streamFn: models.streamSimple.bind(models),
    tools,
    maxSteps: settings.maxSteps,
    verbose,
    output: process.stdout,
  });
}

async function runQuestion(agent: TicketAgent, question: string): Promise<RunResult> {
  console.log(`\n${"=".repeat(60)}\n用户: ${question}\n${"-".repeat(60)}`);
  const result = await agent.run(question);
  console.log("\n最终答案:");
  console.log(result.finalAnswer || "（模型未返回文本答案）");
  console.log(
    `\n运行时长: ${(result.durationMs / 1000).toFixed(2)}s | 轮次: ${result.steps} | 工具调用: ${result.toolCalls}`,
  );
  return result;
}

async function repl(agent: TicketAgent): Promise<void> {
  console.log(BANNER);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      let line: string;
      try {
        line = (await rl.question("\n用户> ")).trim();
      } catch {
        console.log("\n再见。");
        break;
      }
      if (!line) continue;
      const lowered = line.toLowerCase();
      if (["exit", "quit", "q"].includes(lowered)) break;
      if (["help", "/help"].includes(lowered)) {
        console.log(BANNER);
        continue;
      }
      if (["demo", "/demo"].includes(lowered)) {
        for (const question of DEMO_QUESTIONS) await runQuestion(agent, question);
        continue;
      }
      await runQuestion(agent, line);
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const verbose = argv.includes("--verbose");
  const settings = loadSettings();

  if (argv.includes("--show-tools")) {
    const knowledgeBase = KnowledgeBase.load(KNOWLEDGE_DIR);
    console.log(describeToolsJson(buildTools(knowledgeBase)));
    return;
  }

  let agent: TicketAgent;
  try {
    agent = buildTicketAgent(settings, verbose || settings.verbose);
  } catch (error) {
    console.error(`[启动失败] ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }

  if (argv.includes("--demo")) {
    for (const question of DEMO_QUESTIONS) await runQuestion(agent, question);
    return;
  }

  const question = argv.filter((arg) => !arg.startsWith("--")).join(" ").trim();
  if (question) {
    await runQuestion(agent, question);
    return;
  }

  // 无参数时进入交互模式
  await repl(agent);
}

await main();
