/** 业务模块：用户投诉登记。 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { getOrder, nextComplaintId, nowIso, recordComplaint } from "../data.js";

const HIGH_PRIORITY_WORDS = ["赔偿", "曝光", "12315", "起诉", "媒体", "监管", "律师"];

const schema = Type.Object({
  summary: Type.String({ description: "投诉摘要" }),
  detail: Type.String({ description: "投诉详情与经过" }),
  order_id: Type.Optional(Type.String({ description: "关联订单号（可选）" })),
  contact: Type.Optional(Type.String({ description: "用户联系方式" })),
  expectation: Type.Optional(Type.String({ description: "用户期望的处理结果（可选）" })),
});

export const fileComplaintTool: AgentTool<typeof schema> = {
  name: "file_complaint",
  label: "投诉登记",
  description:
    "登记用户投诉，返回投诉单号、优先级、责任团队与 SLA。涉及态度、服务体验、赔偿诉求时使用。",
  parameters: schema,
  execute: async (_toolCallId, params) => {
    const combined = `${params.summary} ${params.detail} ${params.expectation ?? ""}`;
    const priority = HIGH_PRIORITY_WORDS.some((word) => combined.includes(word)) ? "P1" : "P2";
    const complaintId = nextComplaintId();

    const order = params.order_id ? getOrder(params.order_id) : undefined;
    const linkedOrder = params.order_id
      ? {
          order_id: params.order_id,
          found: order !== undefined,
          product: order?.product ?? null,
          status: order?.status ?? null,
        }
      : null;

    const createdAt = nowIso();
    recordComplaint({
      complaint_id: complaintId,
      summary: params.summary,
      detail: params.detail,
      expectation: params.expectation ?? null,
      priority,
      status: "已登记",
      owner: "客户体验组",
      order_id: params.order_id ?? null,
      contact_registered: Boolean(params.contact),
      created_at: createdAt,
    });

    const data = {
      complaint_id: complaintId,
      status: "已登记",
      priority,
      owner: "客户体验组",
      sla_hours: priority === "P1" ? 4 : 24,
      created_at: createdAt,
      linked_order: linkedOrder,
      contact_registered: Boolean(params.contact),
      next_steps: [
        "客户体验组将在 SLA 内回访并给出处理方案",
        "如需升级，请补充订单号、沟通记录或凭证",
      ],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      details: data,
    };
  },
};
