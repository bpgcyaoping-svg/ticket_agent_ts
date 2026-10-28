/** 真实 DeepSeek 联调测试：RUN_LIVE=1 时执行，会消耗 token。 */

import { describe, expect, it } from "vitest";
import { loadSettings, KNOWLEDGE_DIR } from "../src/config.js";
import { createDeepSeekModels } from "../src/model.js";
import { KnowledgeBase } from "../src/rag.js";
import { TicketAgent } from "../src/agent.js";
import { buildTools } from "../src/tools/index.js";

const RUN_LIVE = process.env.RUN_LIVE === "1";
const settings = loadSettings();

describe.skipIf(!RUN_LIVE || !settings.apiKey)("live deepseek", () => {
  it("真实模型能发起工具调用并生成最终答复", async () => {
    const { models, model } = createDeepSeekModels(settings);
    const agent = new TicketAgent({
      model,
      streamFn: models.streamSimple.bind(models),
      tools: buildTools(KnowledgeBase.load(KNOWLEDGE_DIR)),
      maxSteps: settings.maxSteps,
      output: { write: () => {} },
    });

    const result = await agent.run("帮我查一下订单 ORD-20261001 的物流状态");

    expect(result.toolCalls).toBeGreaterThanOrEqual(1);
    expect(result.finalAnswer.length).toBeGreaterThan(0);
    expect(result.stopReason).toBe("answer");
    console.log(
      `live: steps=${result.steps} toolCalls=${result.toolCalls} ` +
        `duration=${(result.durationMs / 1000).toFixed(2)}s`,
    );
  }, 120_000);
});
