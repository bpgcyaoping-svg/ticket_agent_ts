import { describe, expect, it } from "vitest";
import { FAULTS, COMPLAINTS } from "../src/data.js";
import {
  createScriptedAgent,
  fauxAssistantMessage,
  fauxToolCall,
  type FauxResponseStep,
} from "./helpers.js";

describe("agent loop 集成场景", () => {
  it("单工具后回答", async () => {
    const { agent, output } = createScriptedAgent([
      fauxAssistantMessage(fauxToolCall("query_order", { order_id: "ORD-20261001" }, { id: "call_1" })),
      fauxAssistantMessage("订单 ORD-20261001 运输中，预计 2026-10-29 送达。"),
    ]);

    const result = await agent.run("查订单 ORD-20261001");

    expect(result.stopReason).toBe("answer");
    expect(result.steps).toBe(2);
    expect(result.toolCalls).toBe(1);
    expect(result.finalAnswer).toContain("ORD-20261001");
    // 流式输出包含最终答复
    expect(output.text).toContain("运输中");
  });

  it("多轮串行工具：意图 → 订单 → 回答", async () => {
    const { agent } = createScriptedAgent([
      fauxAssistantMessage(fauxToolCall("classify_intent", { text: "查订单" })),
      fauxAssistantMessage(fauxToolCall("query_order", { order_id: "ORD-20261001" })),
      fauxAssistantMessage("已查到订单。"),
    ]);

    const result = await agent.run("帮我看看订单到哪了");

    expect(result.steps).toBe(3);
    expect(result.toolCalls).toBe(2);
    expect(result.stopReason).toBe("answer");
  });

  it("工具业务错误回填给模型后继续回答", async () => {
    const { agent } = createScriptedAgent([
      fauxAssistantMessage(fauxToolCall("query_order", { order_id: "ORD-NOT-EXIST" })),
      fauxAssistantMessage("未找到该订单，请核对订单号。"),
    ]);

    const result = await agent.run("查订单 ORD-NOT-EXIST");

    expect(result.stopReason).toBe("answer");
    expect(result.finalAnswer).toContain("未找到");
  });

  it("未知工具报错不打断 Loop", async () => {
    const { agent } = createScriptedAgent([
      fauxAssistantMessage(fauxToolCall("drop_database", {})),
      fauxAssistantMessage("我无法执行该操作，已改为直接回答。"),
    ]);

    const result = await agent.run("删库");

    expect(result.stopReason).toBe("answer");
    expect(result.finalAnswer).toContain("无法执行");
  });

  it("RAG 咨询场景", async () => {
    const { agent } = createScriptedAgent([
      fauxAssistantMessage(fauxToolCall("search_knowledge_base", { question: "耳机怎么配对" })),
      fauxAssistantMessage("配对方法：长按电源键 3 秒进入配对模式。"),
    ]);

    const result = await agent.run("耳机怎么配对");

    expect(result.toolCalls).toBe(1);
    expect(result.finalAnswer).toContain("配对");
  });

  it("故障 + 投诉连续登记", async () => {
    const { agent } = createScriptedAgent([
      fauxAssistantMessage(
        fauxToolCall("report_system_fault", {
          title: "登录 500",
          description: "App 登录持续报 500",
          severity: "high",
        }),
      ),
      fauxAssistantMessage(
        fauxToolCall("file_complaint", { summary: "故障没人管", detail: "两天无人跟进" }),
      ),
      fauxAssistantMessage("已登记故障 FLT-0001 与投诉 CMP-0001。"),
    ]);

    const result = await agent.run("App 一直报错，而且没人处理，我要投诉");

    expect(result.toolCalls).toBe(2);
    expect(FAULTS["FLT-0001"]).toBeDefined();
    expect(COMPLAINTS["CMP-0001"]).toBeDefined();
    expect(result.finalAnswer).toContain("FLT-0001");
  });

  it("重复工具调用第三次被拦截", async () => {
    const repeated: FauxResponseStep = fauxAssistantMessage(
      fauxToolCall("query_order", { order_id: "ORD-20261001" }, { id: "call_r" }),
    );
    const { agent } = createScriptedAgent([repeated, repeated, repeated]);

    const result = await agent.run("一直重复查订单");

    expect(result.steps).toBe(3);
    expect(result.stopReason).toBe("repeated_action");
    // 第 3 次调用在进入 beforeToolCall 时已被拦截（事件仍计入 tool_execution_start）
    expect(result.toolCalls).toBe(3);
    expect(result.finalAnswer).toContain("重复");
  });

  it("最大轮次保护", async () => {
    const call: FauxResponseStep = fauxAssistantMessage(
      fauxToolCall("classify_intent", { text: "x" }),
    );
    const { agent } = createScriptedAgent([call, call, call, call], { maxSteps: 3 });

    const result = await agent.run("测试最大轮次");

    expect(result.steps).toBe(3);
    expect(result.stopReason).toBe("max_steps");
    expect(result.finalAnswer).toContain("最大推理轮次");
  });

  it("模型错误给出兜底答复", async () => {
    const { agent } = createScriptedAgent([
      fauxAssistantMessage("", { stopReason: "error", errorMessage: "模拟网络失败" }),
    ]);

    const result = await agent.run("任意问题");

    expect(result.stopReason).toBe("error");
    expect(result.finalAnswer).toContain("模拟网络失败");
  });

  it("verbose 事件序列完整", async () => {
    const { agent, output } = createScriptedAgent(
      [
        fauxAssistantMessage(fauxToolCall("query_order", { order_id: "ORD-20261001" }, { id: "call_1" })),
        fauxAssistantMessage("订单运输中。"),
      ],
      { verbose: true },
    );

    await agent.run("查订单");

    expect(output.text).toContain("[agent_start]");
    expect(output.text).toContain("[llm_request] step=1");
    expect(output.text).toContain("[tool_start] name=query_order tool_call_id=call_1");
    expect(output.text).toContain("[tool_end] name=query_order tool_call_id=call_1 is_error=false");
    expect(output.text).toContain("[message_end] step=2");
    expect(output.text).toMatch(/\[agent_end\] steps=2 stop_reason=answer tool_calls=1/);
  });
});
