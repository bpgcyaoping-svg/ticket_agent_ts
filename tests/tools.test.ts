import { beforeEach, describe, expect, it } from "vitest";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { COMPLAINTS, FAULTS, resetBusinessState } from "../src/data.js";
import { KnowledgeBase } from "../src/rag.js";
import { KNOWLEDGE_DIR } from "../src/config.js";
import { TOOL_NAMES, buildTools, describeToolsJson } from "../src/tools/index.js";
import { classify } from "../src/tools/intent.js";

let tools: AgentTool[];

function tool(name: string): AgentTool {
  const found = tools.find((item) => item.name === name);
  if (!found) throw new Error(`工具未注册: ${name}`);
  return found;
}

async function execute(name: string, params: Record<string, unknown>) {
  return tool(name).execute("call_test", params as never);
}

beforeEach(() => {
  resetBusinessState();
  tools = buildTools(KnowledgeBase.load(KNOWLEDGE_DIR));
});

describe("工具注册与视图", () => {
  it("注册 6 个工具且视图不泄露 handler", () => {
    expect(tools.map((item) => item.name).sort()).toEqual([...TOOL_NAMES].sort());
    const rendered = describeToolsJson(tools);
    expect(rendered).not.toContain("execute");
    expect(rendered).not.toContain("handler");
    for (const item of JSON.parse(rendered) as Record<string, unknown>[]) {
      expect(Object.keys(item).sort()).toEqual(["description", "name", "parameters"]);
    }
  });
});

describe("classify_intent", () => {
  it("六个类别", () => {
    expect(classify("我要退款").category).toBe("退款");
    expect(classify("订单物流到哪了").category).toBe("订单物流");
    expect(classify("耳机怎么配对").category).toBe("产品咨询");
    expect(classify("App 闪退报错").category).toBe("系统故障");
    expect(classify("我要投诉").category).toBe("投诉");
    expect(classify("你好，在吗").category).toBe("其他");
  });

  it("工具调用返回结构化分类", async () => {
    const result = await execute("classify_intent", { text: "帮我查一下订单物流" });
    const details = result.details as { category: string; suggested_tools: string[] };
    expect(details.category).toBe("订单物流");
    expect(details.suggested_tools).toContain("query_order");
  });
});

describe("query_order", () => {
  it("命中订单", async () => {
    const result = await execute("query_order", { order_id: "ORD-20261001" });
    const details = result.details as { order: { status: string } };
    expect(details.order.status).toBe("运输中");
  });

  it("订单不存在抛 ORDER_NOT_FOUND", async () => {
    await expect(execute("query_order", { order_id: "ORD-NOT-EXIST" })).rejects.toThrow(
      /ORDER_NOT_FOUND/,
    );
  });
});

describe("query_refund", () => {
  it("按退款单号查询", async () => {
    const result = await execute("query_refund", { refund_id: "RF-20261002" });
    const details = result.details as { refund: { status: string } };
    expect(details.refund.status).toBe("已退款");
  });

  it("按订单号查询最新退款", async () => {
    const result = await execute("query_refund", { order_id: "ORD-20261001" });
    const details = result.details as { refund: { refund_id: string } };
    expect(details.refund.refund_id).toBe("RF-20261001");
  });

  it("无退款记录抛 REFUND_NOT_FOUND", async () => {
    await expect(execute("query_refund", { order_id: "ORD-20261003" })).rejects.toThrow(
      /REFUND_NOT_FOUND/,
    );
  });

  it("两个参数都缺抛 INVALID_ARGUMENTS", async () => {
    await expect(execute("query_refund", {})).rejects.toThrow(/INVALID_ARGUMENTS/);
  });
});

describe("search_knowledge_base", () => {
  it("命中知识库", async () => {
    const result = await execute("search_knowledge_base", { question: "耳机怎么配对" });
    const details = result.details as { count: number; results: { source: string }[] };
    expect(details.count).toBeGreaterThan(0);
    expect(details.results[0]!.source).toBe("产品使用-耳机.md");
  });

  it("未命中抛 KB_NO_MATCH", async () => {
    await expect(execute("search_knowledge_base", { question: "量子力学入门" })).rejects.toThrow(
      /KB_NO_MATCH/,
    );
  });
});

describe("report_system_fault", () => {
  it("登记故障并分派团队", async () => {
    const result = await execute("report_system_fault", {
      title: "登录失败",
      description: "持续报 500 错误",
      severity: "high",
      affected_service: "登录",
      platform: "Android",
      app_version: "6.2.1",
    });
    const details = result.details as {
      fault_id: string;
      assigned_team: string;
      sla_hours: number;
      diagnostics: { trace_id: string };
    };
    expect(details.fault_id).toBe("FLT-0001");
    expect(details.assigned_team).toBe("账号与安全组");
    expect(details.sla_hours).toBe(8);
    expect(details.diagnostics.trace_id).toBe("trace-flt-0001");
    expect(FAULTS["FLT-0001"]).toBeDefined();
  });
});

describe("file_complaint", () => {
  it("关联订单的投诉", async () => {
    const result = await execute("file_complaint", {
      summary: "退款没人处理",
      detail: "客服一直没有回复",
      order_id: "ORD-20261002",
    });
    const details = result.details as {
      complaint_id: string;
      priority: string;
      linked_order: { found: boolean };
    };
    expect(details.complaint_id).toBe("CMP-0001");
    expect(details.priority).toBe("P2");
    expect(details.linked_order.found).toBe(true);
    expect(COMPLAINTS["CMP-0001"]).toBeDefined();
  });

  it("高优先级关键词升级为 P1，未知订单也接受", async () => {
    const result = await execute("file_complaint", {
      summary: "要求赔偿",
      detail: "否则向 12315 曝光",
      order_id: "ORD-NOT-EXIST",
    });
    const details = result.details as {
      priority: string;
      sla_hours: number;
      linked_order: { found: boolean };
    };
    expect(details.priority).toBe("P1");
    expect(details.sla_hours).toBe(4);
    expect(details.linked_order.found).toBe(false);
  });
});
