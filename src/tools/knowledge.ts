/** 业务模块：产品使用咨询（RAG 检索）。 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { KnowledgeBase } from "../rag.js";

const schema = Type.Object({
  question: Type.String({ description: "用户的产品使用问题" }),
  top_k: Type.Optional(Type.Integer({ description: "返回段落数量，默认 3，最大 5" })),
});

export function buildKnowledgeTool(knowledgeBase: KnowledgeBase): AgentTool<typeof schema> {
  return {
    name: "search_knowledge_base",
    label: "知识库检索",
    description:
      "检索产品使用知识库，覆盖耳机/手环使用、账号登录、保修、发票与退款政策。回答产品使用咨询时使用。",
    parameters: schema,
    execute: async (_toolCallId, params) => {
      const topK = Math.min(Math.max(params.top_k ?? 3, 1), 5);
      const hits = knowledgeBase.search(params.question, topK);
      if (hits.length === 0) {
        throw new Error("KB_NO_MATCH: 知识库未检索到相关内容，请补充产品型号或转人工处理");
      }
      const data = {
        question: params.question,
        count: hits.length,
        results: hits.map((hit) => ({
          source: hit.source,
          section: hit.section,
          score: Math.round(hit.score * 10000) / 10000,
          content: hit.content,
        })),
        source: "product-knowledge-base",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        details: data,
      };
    },
  };
}
