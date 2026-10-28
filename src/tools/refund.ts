/** 业务模块：退款进度查询。 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { findRefundsByOrder, getOrder, getRefund, nowIso } from "../data.js";

const schema = Type.Object({
  refund_id: Type.Optional(Type.String({ description: "退款单号，例如 RF-20261001" })),
  order_id: Type.Optional(Type.String({ description: "订单号，例如 ORD-20261001" })),
});

export const queryRefundTool: AgentTool<typeof schema> = {
  name: "query_refund",
  label: "退款查询",
  description:
    "查询退款单进度与时间线。可以用退款单号查询，也可以用订单号查询该订单最新的退款记录。",
  parameters: schema,
  execute: async (_toolCallId, params) => {
    const { refund_id: refundId, order_id: orderId } = params;
    if (!refundId && !orderId) {
      throw new Error("INVALID_ARGUMENTS: refund_id 与 order_id 至少提供一个");
    }

    let refund;
    if (refundId) {
      refund = getRefund(refundId);
      if (!refund) {
        throw new Error(`REFUND_NOT_FOUND: 未找到退款单 ${refundId}`);
      }
    } else {
      const refunds = findRefundsByOrder(orderId ?? "");
      if (refunds.length === 0) {
        throw new Error(`REFUND_NOT_FOUND: 订单 ${orderId} 暂无退款记录`);
      }
      refund = refunds.sort((a, b) => a.applied_at.localeCompare(b.applied_at)).at(-1)!;
    }

    const order = getOrder(refund.order_id) ?? null;
    const data = { refund, order, source: "after-sales", queried_at: nowIso() };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      details: data,
    };
  },
};
