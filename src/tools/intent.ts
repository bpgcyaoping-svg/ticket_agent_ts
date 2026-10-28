/** 业务模块：用户意图识别分类。 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";

// 顺序即同等命中数下的优先级
const INTENT_RULES: [string, string[], string[]][] = [
  ["退款", ["退款", "退货", "退钱", "退单", "申请退"], ["query_refund", "query_order"]],
  ["订单物流", ["订单", "物流", "快递", "发货", "到货", "签收", "配送", "运费"], ["query_order"]],
  [
    "产品咨询",
    ["怎么用", "如何使用", "如何", "怎么", "功能", "设置", "配对", "连接", "充电", "说明书", "保修", "发票", "固件"],
    ["search_knowledge_base"],
  ],
  [
    "系统故障",
    ["故障", "报错", "错误", "打不开", "闪退", "崩溃", "卡死", "无法登录", "异常", "bug", "500"],
    ["report_system_fault"],
  ],
  ["投诉", ["投诉", "差评", "态度", "维权", "欺骗", "生气", "太差", "垃圾", "曝光"], ["file_complaint"]],
];

export interface IntentResult {
  category: string;
  confidence: number;
  matched_keywords: string[];
  suggested_tools: string[];
  reason: string;
}

export function classify(text: string): IntentResult {
  const lowered = text.toLowerCase();
  let bestCategory = "其他";
  let bestKeywords: string[] = [];
  let bestTools: string[] = [];

  for (const [category, keywords, tools] of INTENT_RULES) {
    const matched = keywords.filter((keyword) => lowered.includes(keyword.toLowerCase()));
    if (matched.length > bestKeywords.length) {
      bestCategory = category;
      bestKeywords = matched;
      bestTools = tools;
    }
  }

  if (bestKeywords.length === 0) {
    return {
      category: "其他",
      confidence: 0.3,
      matched_keywords: [],
      suggested_tools: [],
      reason: "未命中业务关键词，建议先向用户澄清诉求",
    };
  }

  const confidence = Math.min(0.95, 0.55 + 0.1 * bestKeywords.length);
  return {
    category: bestCategory,
    confidence: Math.round(confidence * 100) / 100,
    matched_keywords: bestKeywords,
    suggested_tools: bestTools,
    reason: `命中关键词: ${bestKeywords.join("、")}`,
  };
}

const schema = Type.Object({
  text: Type.String({ description: "用户原始问题或工单内容" }),
});

export const classifyIntentTool: AgentTool<typeof schema> = {
  name: "classify_intent",
  label: "意图识别",
  description:
    "对用户诉求做意图分类，返回类别、置信度和建议工具。" +
    "类别包括：退款、订单物流、产品咨询、系统故障、投诉、其他。当用户诉求不明确时优先调用。",
  parameters: schema,
  execute: async (_toolCallId, params) => {
    const result = classify(params.text);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      details: result,
    };
  },
};
