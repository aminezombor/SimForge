import { randomUUID } from 'node:crypto';
import type {
  ModelDescriptor,
  ProviderEvent,
  ProviderRequest,
} from '../../shared/contracts';
import {
  checkedJson,
  type FetchLike,
  parseServerSentEvents,
  type ProviderAdapter,
  ProviderError,
  ProviderCancellationRegistry,
  providerHeaders,
  requireApiKey,
} from './provider';

interface NvidiaModelList {
  data?: Array<{ id?: string; name?: string }>;
}

interface NvidiaStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class NvidiaProviderAdapter implements ProviderAdapter {
  readonly id = 'nvidia' as const;
  private readonly endpoint: string;
  private readonly fetcher: FetchLike;
  private readonly requests = new ProviderCancellationRegistry();

  cancel(requestId: string): void {
    this.requests.cancel(requestId);
  }

  constructor(
    endpoint = 'https://integrate.api.nvidia.com/v1',
    fetcher: FetchLike = globalThis.fetch,
  ) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.fetcher = fetcher;
  }

  async discoverModels(apiKey: string | null, signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const key = requireApiKey(apiKey, 'NVIDIA');
    const response = await this.fetcher(`${this.endpoint}/models`, {
      headers: providerHeaders(key),
      ...(signal ? { signal } : {}),
    });
    const payload = (await checkedJson(response, 'NVIDIA')) as NvidiaModelList;
    return (payload.data ?? [])
      .filter((model): model is { id: string; name?: string } => Boolean(model.id))
      .map((model) => this.unprobedDescriptor(model.id, model.name ?? model.id));
  }

  async probeCapabilities(
    apiKey: string | null,
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ModelDescriptor> {
    const key = requireApiKey(apiKey, 'NVIDIA');
    const request: ProviderRequest = {
      requestId: randomUUID(),
      modelId,
      purpose: 'Non-mutating provider capability probe',
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Reply with the single word ready.' }],
        },
      ],
      tools: [],
    };
    let streamed = false;
    for await (const event of this.stream(key, request, signal)) {
      if (event.type === 'text-delta' || event.type === 'completed') streamed = true;
    }
    if (!streamed) {
      throw new ProviderError('CAPABILITY_PROBE_FAILED', 'NVIDIA model produced no usable stream');
    }
    const lower = modelId.toLowerCase();
    const textOnlyNemotron = lower.includes('nemotron-3-ultra');
    return {
      ...this.unprobedDescriptor(modelId, modelId),
      capabilities: {
        text: true,
        vision: textOnlyNemotron ? false : 'unknown',
        tools: 'unknown',
        streaming: true,
        structuredOutput: 'unknown',
        reasoningControls: lower.includes('nemotron') ? true : 'unknown',
      },
      probedAt: new Date().toISOString(),
    };
  }

  async *stream(
    apiKey: string | null,
    request: ProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    const key = requireApiKey(apiKey, 'NVIDIA');
    const requestSignal = this.requests.begin(request.requestId, signal);
    try {
    const response = await this.fetcher(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: providerHeaders(key),
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n'),
        })),
        tools: request.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: requestSignal,
    });
    const pendingTools = new Map<number, { callId: string; name: string; argumentsText: string }>();
    for await (const raw of parseServerSentEvents(response)) {
      const chunk = raw as NvidiaStreamChunk;
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) yield { type: 'text-delta', text: delta.content };
      for (const toolCall of delta?.tool_calls ?? []) {
        const index = toolCall.index ?? 0;
        const previous = pendingTools.get(index);
        pendingTools.set(index, {
          callId: toolCall.id ?? previous?.callId ?? randomUUID(),
          name: toolCall.function?.name ?? previous?.name ?? '',
          argumentsText: `${previous?.argumentsText ?? ''}${toolCall.function?.arguments ?? ''}`,
        });
      }
      if (chunk.choices?.[0]?.finish_reason) {
        for (const [index, call] of [...pendingTools].sort(([left], [right]) => left - right)) {
          pendingTools.delete(index);
          if (!call.name) continue;
          try {
            yield {
              type: 'tool-call',
              callId: call.callId,
              name: call.name,
              arguments: JSON.parse(call.argumentsText || '{}') as Record<string, unknown>,
            };
          } catch {
            yield { type: 'warning', message: `Provider returned invalid arguments for ${call.name}` };
          }
        }
      }
      if (chunk.usage) {
        yield {
          type: 'usage',
          inputTokens: chunk.usage.prompt_tokens ?? null,
          outputTokens: chunk.usage.completion_tokens ?? null,
        };
      }
    }
    for (const call of pendingTools.values()) {
      if (!call.name) continue;
      try {
        yield {
          type: 'tool-call',
          callId: call.callId,
          name: call.name,
          arguments: JSON.parse(call.argumentsText || '{}') as Record<string, unknown>,
        };
      } catch {
        yield { type: 'warning', message: `Provider returned invalid arguments for ${call.name}` };
      }
    }
    yield { type: 'completed' };
    } finally {
      this.requests.complete(request.requestId);
    }
  }

  private unprobedDescriptor(modelId: string, displayName: string): ModelDescriptor {
    const textOnlyNemotron = modelId.toLowerCase().includes('nemotron-3-ultra');
    return {
      providerId: this.id,
      modelId,
      displayName,
      capabilities: {
        text: true,
        vision: textOnlyNemotron ? false : 'unknown',
        tools: 'unknown',
        streaming: 'unknown',
        structuredOutput: 'unknown',
        reasoningControls: 'unknown',
      },
      contextWindow: null,
      maxOutputTokens: null,
      probedAt: null,
    };
  }
}
