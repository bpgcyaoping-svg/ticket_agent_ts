/** DeepSeek Provider：pi-ai 内置目录没有 deepseek-v4-flash，这里用自定义
 * provider 声明模型，保持与 Python 版一致的模型 ID 与环境变量约定。
 *
 * pi-ai 对 baseUrl 命中 api.deepseek.com 的 openai-completions 模型自动启用
 * deepseek thinkingFormat：thinkingLevel "off" 会发送 thinking: { type: "disabled" }，
 * 等价于 Python 版的 extra_body={"thinking": {"type": "disabled"}}。
 */

import {
  createModels,
  createProvider,
  envApiKeyAuth,
  type Model,
  type MutableModels,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import type { Settings } from "./config.js";

export const PROVIDER_ID = "deepseek";
export const API_ID = "openai-completions" as const;

export function createDeepSeekProvider(settings: Settings) {
  const model: Model<typeof API_ID> = {
    id: settings.model,
    name: settings.model,
    api: API_ID,
    provider: PROVIDER_ID,
    baseUrl: settings.baseUrl,
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  };

  return createProvider({
    id: PROVIDER_ID,
    name: "DeepSeek",
    baseUrl: settings.baseUrl,
    auth: { apiKey: envApiKeyAuth("DeepSeek API key", ["DEEPSEEK_API_KEY"]) },
    models: [model],
    api: openAICompletionsApi(),
  });
}

export interface DeepSeekModels {
  models: MutableModels;
  model: Model<"openai-completions">;
}

export function createDeepSeekModels(settings: Settings): DeepSeekModels {
  const models = createModels();
  models.setProvider(createDeepSeekProvider(settings));
  const model = models.getModel(PROVIDER_ID, settings.model);
  if (!model) {
    throw new Error(`模型未注册: ${PROVIDER_ID}/${settings.model}`);
  }
  return { models, model: model as Model<"openai-completions"> };
}
