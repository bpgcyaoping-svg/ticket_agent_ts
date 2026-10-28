/** 工具装配：把 6 个业务工具组装成 pi 的 AgentTool 列表。 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { KnowledgeBase } from "../rag.js";
import { classifyIntentTool } from "./intent.js";
import { queryOrderTool } from "./order.js";
import { queryRefundTool } from "./refund.js";
import { buildKnowledgeTool } from "./knowledge.js";
import { reportSystemFaultTool } from "./fault.js";
import { fileComplaintTool } from "./complaint.js";

export const TOOL_NAMES = [
  "classify_intent",
  "query_order",
  "query_refund",
  "search_knowledge_base",
  "report_system_fault",
  "file_complaint",
] as const;

export function buildTools(knowledgeBase: KnowledgeBase): AgentTool<any>[] {
  return [
    classifyIntentTool,
    queryOrderTool,
    queryRefundTool,
    buildKnowledgeTool(knowledgeBase),
    reportSystemFaultTool,
    fileComplaintTool,
  ];
}

/** 模型可见的工具视图：只含 name / description / parameters，不含 execute。 */
export function describeTools(tools: AgentTool[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

export function describeToolsJson(tools: AgentTool[]): string {
  return JSON.stringify(describeTools(tools), null, 2);
}
