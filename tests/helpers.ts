/** 测试辅助：faux provider 替代真实 DeepSeek，按脚本返回助手消息。 */

import { createModels, fauxProvider, type FauxResponseStep } from "@earendil-works/pi-ai";
import type { AgentTool, StreamFn } from "@earendil-works/pi-agent-core";
import { TicketAgent } from "../src/agent.js";
import { KnowledgeBase } from "../src/rag.js";
import { KNOWLEDGE_DIR } from "../src/config.js";
import { buildTools } from "../src/tools/index.js";
import { resetBusinessState } from "../src/data.js";

export { fauxAssistantMessage, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
export type { FauxResponseStep };

export class OutputSink {
  text = "";
  write(chunk: string): void {
    this.text += chunk;
  }
}

export interface ScriptedAgent {
  agent: TicketAgent;
  setResponses: (responses: FauxResponseStep[]) => void;
  output: OutputSink;
  tools: AgentTool[];
}

export function createScriptedAgent(
  responses: FauxResponseStep[],
  options: { maxSteps?: number; verbose?: boolean } = {},
): ScriptedAgent {
  resetBusinessState();
  const faux = fauxProvider({ models: [{ id: "scripted-deepseek" }] });
  const models = createModels();
  models.setProvider(faux.provider);
  faux.setResponses(responses);

  const tools = buildTools(KnowledgeBase.load(KNOWLEDGE_DIR));
  const output = new OutputSink();
  const streamFn: StreamFn = models.streamSimple.bind(models);

  const agent = new TicketAgent({
    model: faux.getModel(),
    streamFn,
    tools,
    maxSteps: options.maxSteps ?? 8,
    verbose: options.verbose ?? false,
    output,
  });
  return { agent, setResponses: faux.setResponses, output, tools };
}
