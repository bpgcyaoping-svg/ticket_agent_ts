/** 演示用业务数据仓储（内存实现，可替换为真实订单/售后/工单服务）。 */

export interface OrderRecord {
  order_id: string;
  user_id: string;
  user_name: string;
  product: string;
  sku: string;
  quantity: number;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at?: string;
  shipped_at?: string;
  carrier?: string | null;
  tracking_no?: string | null;
  eta?: string;
  delivered_at?: string;
  address_masked: string;
  after_sales: string;
}

export interface RefundRecord {
  refund_id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  reason: string;
  applied_at: string;
  refunded_at?: string;
  expected_arrival: string;
  timeline: { at: string; event: string }[];
}

export const ORDERS: Record<string, OrderRecord> = {
  "ORD-20261001": {
    order_id: "ORD-20261001",
    user_id: "U-10086",
    user_name: "张先生",
    product: "无线降噪耳机 Pro",
    sku: "AUD-NC-PRO",
    quantity: 1,
    amount: 899.0,
    currency: "CNY",
    status: "运输中",
    created_at: "2026-10-20 10:12:00",
    paid_at: "2026-10-20 10:13:24",
    shipped_at: "2026-10-21 18:40:00",
    carrier: "顺丰速运",
    tracking_no: "SF1234567890",
    eta: "2026-10-29",
    address_masked: "上海市浦东新区 **** 号",
    after_sales: "已签收后支持 7 天无理由退货",
  },
  "ORD-20261002": {
    order_id: "ORD-20261002",
    user_id: "U-10086",
    user_name: "张先生",
    product: "智能手环 Lite",
    sku: "WEA-LITE-02",
    quantity: 1,
    amount: 299.0,
    currency: "CNY",
    status: "已完成",
    created_at: "2026-10-08 09:30:00",
    paid_at: "2026-10-08 09:31:10",
    shipped_at: "2026-10-09 11:00:00",
    carrier: "京东物流",
    tracking_no: "JDVA00012345678",
    eta: "2026-10-11",
    delivered_at: "2026-10-11 15:22:00",
    address_masked: "上海市浦东新区 **** 号",
    after_sales: "已退款 299.00 元",
  },
  "ORD-20261003": {
    order_id: "ORD-20261003",
    user_id: "U-20001",
    user_name: "李女士",
    product: "便携意式咖啡机",
    sku: "COF-ESP-01",
    quantity: 2,
    amount: 2598.0,
    currency: "CNY",
    status: "待发货",
    created_at: "2026-10-27 20:05:00",
    paid_at: "2026-10-27 20:06:32",
    carrier: null,
    tracking_no: null,
    eta: "预计 2026-10-30 前发出",
    address_masked: "北京市朝阳区 **** 号",
    after_sales: "支持 7 天无理由退货",
  },
};

export const REFUNDS: Record<string, RefundRecord> = {
  "RF-20261001": {
    refund_id: "RF-20261001",
    order_id: "ORD-20261001",
    status: "审核中",
    amount: 899.0,
    currency: "CNY",
    reason: "物流长时间未更新",
    applied_at: "2026-10-27 14:20:00",
    expected_arrival: "2026-10-31",
    timeline: [
      { at: "2026-10-27 14:20:00", event: "用户提交退款申请" },
      { at: "2026-10-27 16:05:00", event: "系统受理，进入审核" },
    ],
  },
  "RF-20261002": {
    refund_id: "RF-20261002",
    order_id: "ORD-20261002",
    status: "已退款",
    amount: 299.0,
    currency: "CNY",
    reason: "七天无理由退货",
    applied_at: "2026-10-12 10:00:00",
    refunded_at: "2026-10-14 09:30:00",
    expected_arrival: "2026-10-14",
    timeline: [
      { at: "2026-10-12 10:00:00", event: "用户提交退款申请" },
      { at: "2026-10-13 11:20:00", event: "仓库签收退货" },
      { at: "2026-10-14 09:30:00", event: "退款已原路退回" },
    ],
  },
};

export const FAULTS: Record<string, Record<string, unknown>> = {};
export const COMPLAINTS: Record<string, Record<string, unknown>> = {};

const sequence = { fault: 0, complaint: 0 };

/** 测试辅助：清空工单类数据并重置自增编号。 */
export function resetBusinessState(): void {
  for (const key of Object.keys(FAULTS)) delete FAULTS[key];
  for (const key of Object.keys(COMPLAINTS)) delete COMPLAINTS[key];
  sequence.fault = 0;
  sequence.complaint = 0;
}

export function nowIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  );
}

export function getOrder(orderId: string): OrderRecord | undefined {
  const order = ORDERS[orderId];
  return order ? structuredClone(order) : undefined;
}

export function getRefund(refundId: string): RefundRecord | undefined {
  const refund = REFUNDS[refundId];
  return refund ? structuredClone(refund) : undefined;
}

export function findRefundsByOrder(orderId: string): RefundRecord[] {
  return Object.values(REFUNDS)
    .filter((refund) => refund.order_id === orderId)
    .map((refund) => structuredClone(refund));
}

export function nextFaultId(): string {
  sequence.fault += 1;
  return `FLT-${String(sequence.fault).padStart(4, "0")}`;
}

export function nextComplaintId(): string {
  sequence.complaint += 1;
  return `CMP-${String(sequence.complaint).padStart(4, "0")}`;
}

export function recordFault(record: Record<string, unknown>): void {
  FAULTS[String(record.fault_id)] = structuredClone(record);
}

export function recordComplaint(record: Record<string, unknown>): void {
  COMPLAINTS[String(record.complaint_id)] = structuredClone(record);
}
