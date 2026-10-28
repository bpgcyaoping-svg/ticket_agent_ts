/** 业务模块：订单查询。 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { getOrder, nowIso } from "../data.js";

const schema = Type.Object({
  order_id: Type.String({ description: "订单号，例如 ORD-20261001" }),
});

export const queryOrderTool: AgentTool<typeof schema> = {
  name: "query_order",
  label: "订单查询",
  description:
    "根据订单号查询订单详情，包括商品、金额、订单状态、物流单号、预计送达时间与售后政策。",
  parameters: schema,
  execute: async (_toolCallId, params) => {
    const order = getOrder(params.order_id);
    if (!order) {
      throw new Error(`ORDER_NOT_FOUND: 未找到订单 ${params.order_id}，请核对订单号后重试`);
    }
    const data = { order, source: "order-center", queried_at: nowIso() };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      details: data,
    };
  },
};
