/** 业务模块：系统故障反馈与诊断信息采集。 */

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { nextFaultId, nowIso, recordFault } from "../data.js";

const SEVERITY_SLA: Record<string, number> = {
  low: 72,
  medium: 24,
  high: 8,
  critical: 4,
};

function pickTeam(text: string): string {
  const lowered = text.toLowerCase();
  const rules: [string[], string][] = [
    [["登录", "账号", "密码", "验证码", "认证"], "账号与安全组"],
    [["支付", "退款", "订单", "结算", "发票"], "交易平台组"],
    [["闪退", "崩溃", "客户端", "app", "页面", "加载"], "客户端研发组"],
  ];
  for (const [keywords, team] of rules) {
    if (keywords.some((keyword) => lowered.includes(keyword))) {
      return team;
    }
  }
  return "基础平台组";
}

const schema = Type.Object({
  title: Type.String({ description: "故障标题" }),
  description: Type.String({ description: "故障现象与复现步骤" }),
  severity: Type.Optional(
    Type.Union(
      [Type.Literal("low"), Type.Literal("medium"), Type.Literal("high"), Type.Literal("critical")],
      { description: "严重程度，默认 medium" },
    ),
  ),
  affected_service: Type.Optional(Type.String({ description: "受影响的业务或服务，例如 登录、支付、订单" })),
  contact: Type.Optional(Type.String({ description: "用户联系方式" })),
  platform: Type.Optional(Type.String({ description: "平台，例如 iOS、Android、Web" })),
  app_version: Type.Optional(Type.String({ description: "客户端版本号" })),
});

export const reportSystemFaultTool: AgentTool<typeof schema> = {
  name: "report_system_fault",
  label: "故障登记",
  description:
    "登记系统故障并采集诊断信息（错误签名、日志快照、客户端环境），" +
    "返回故障单号、优先级、处理团队与 SLA。适用于报错、闪退、无法登录等场景。",
  parameters: schema,
  execute: async (_toolCallId, params) => {
    const severity = params.severity ?? "medium";
    const platform = params.platform ?? "Web";
    const appVersion = params.app_version ?? "unknown";
    const affectedService = params.affected_service;

    const faultId = nextFaultId();
    const assignedTeam = pickTeam(`${params.title} ${params.description} ${affectedService ?? ""}`);
    const signature = params.description.trim().replace(/\n/g, " ").slice(0, 60);
    const slaHours = SEVERITY_SLA[severity] ?? 24;

    const diagnostics = {
      trace_id: `trace-${faultId.toLowerCase()}`,
      collected_at: nowIso(),
      platform,
      app_version: appVersion,
      affected_service: affectedService ?? "未指定",
      error_signature: signature,
      log_snapshot: [
        `[ERROR] ${platform}/${appVersion} ${signature}`,
        "[WARN] 近 10 分钟错误率 3.2%（演示数据）",
        "[INFO] 已采集请求链路、设备环境与客户端版本",
      ],
      signals: ["用户描述已归档", "复现路径待验证"],
    };

    recordFault({
      fault_id: faultId,
      title: params.title,
      description: params.description,
      severity,
      status: "已受理",
      assigned_team: assignedTeam,
      affected_service: affectedService ?? null,
      platform,
      app_version: appVersion,
      contact_registered: Boolean(params.contact),
      created_at: nowIso(),
      diagnostics,
    });

    const data = {
      fault_id: faultId,
      status: "已受理",
      severity,
      assigned_team: assignedTeam,
      sla_hours: slaHours,
      diagnostics,
      contact_registered: Boolean(params.contact),
      next_steps: [
        `${assignedTeam} 将在 ${slaHours} 小时内首次响应`,
        "请保留故障发生时间与操作路径，便于复现",
      ],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      details: data,
    };
  },
};
