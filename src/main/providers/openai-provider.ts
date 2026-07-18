import type {
  ModelDescriptor,
  ProviderEvent,
  ProviderRequest,
} from '../../shared/contracts';
import {
  checkedJson,
  type FetchLike,
  parseServerSentEvents,
  ProviderCancellationRegistry,
  type ProviderAdapter,
  providerHeaders,
  requireApiKey,
} from './provider';

interface OpenAIModelList {
  data?: Array<{ id?: string }>;
}

interface OpenAIStreamEvent {
  type?: string;
  delta?: string;
  item_id?: string;
  output_index?: number;
  arguments?: string;
  item?: {
    id?: string;
    type?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
  };
  response?: {
    usage?: { input_tokens?: number; output_tokens?: number };
  };
}

export class OpenAIProviderAdapter implements ProviderAdapter {
  readonly id = 'openai' as const;
  private readonly endpoint: string;
  private readonly fetcher: FetchLike;
  private readonly requests = new ProviderCancellationRegistry();

  cancel(requestId: string): void {
    this.requests.cancel(requestId);
  }

  constructor(endpoint = 'https://api.openai.com/v1', fetcher: FetchLike = globalThis.fetch) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.fetcher = fetcher;
  }

  async discoverModels(apiKey: string | null, signal?: AbortSignal): Promise<ModelDescriptor[]> {
    const key = requireApiKey(apiKey, 'OpenAI');
    const response = await this.fetcher(`${this.endpoint}/models`, {
      headers: providerHeaders(key),
      ...(signal ? { signal } : {}),
    });
    const payload = (await checkedJson(response, 'OpenAI')) as OpenAIModelList;
    return (payload.data ?? [])
      .filter((model): model is { id: string } => Boolean(model.id))
      .map((model) => this.descriptor(model.id, null));
  }

  async probeCapabilities(
    apiKey: string | null,
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ModelDescriptor> {
    const request: ProviderRequest = {
      requestId: crypto.randomUUID(),
      modelId,
      purpose: 'Non-mutating provider capability probe',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'Reply with ready.' }] }],
      tools: [],
    };
    for await (const event of this.stream(apiKey, request, signal)) {
      // Fully consume the stream so HTTP and event behavior are genuinely probed.
      void event;
    }
    return this.descriptor(modelId, new Date().toISOString());
  }

  async *stream(
    apiKey: string | null,
    request: ProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    const key = requireApiKey(apiKey, 'OpenAI');
    const requestSignal = this.requests.begin(request.requestId, signal);
    try {
    const response = await this.fetcher(`${this.endpoint}/responses`, {
      method: 'POST',
      headers: providerHeaders(key),
      body: JSON.stringify({
        model: request.modelId,
        input: request.messages.map((message) => ({
          role: message.role === 'tool' ? 'user' : message.role,
          content: message.parts.map((part) =>
            part.type === 'text'
              ? { type: 'input_text', text: part.text }
              : { type: 'input_image', image_url: `data:${part.mediaType};base64,${part.data}` },
          ),
        })),
        tools: request.tools.map((tool) => ({
          type: 'function',
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
          strict: true,
        })),
        stream: true,
      }),
      signal: requestSignal,
    });
    const pendingTools = new Map<string, { callId: string; name: string; argumentsText: string }>();
    for await (const raw of parseServerSentEvents(response)) {
      const event = raw as OpenAIStreamEvent;
      if (event.type === 'response.output_text.delta' && event.delta) {
        yield { type: 'text-delta', text: event.delta };
      } else if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
        const key = event.item.id ?? String(event.output_index ?? pendingTools.size);
        pendingTools.set(key, {
          callId: event.item.call_id ?? event.item.id ?? crypto.randomUUID(),
          name: event.item.name ?? '',
          argumentsText: event.item.arguments ?? '',
        });
      } else if (event.type === 'response.function_call_arguments.delta' && event.delta) {
        const key = event.item_id ?? String(event.output_index ?? 0);
        const call = pendingTools.get(key);
        if (call) call.argumentsText += event.delta;
      } else if (event.type === 'response.function_call_arguments.done') {
        const key = event.item_id ?? String(event.output_index ?? 0);
        const call = pendingTools.get(key);
        if (!call?.name) continue;
        pendingTools.delete(key);
        try {
          yield {
            type: 'tool-call',
            callId: call.callId,
            name: call.name,
            arguments: JSON.parse((event.arguments ?? call.argumentsText) || '{}') as Record<string, unknown>,
          };
        } catch {
          yield { type: 'warning', message: `Provider returned invalid arguments for ${call.name}` };
        }
      } else if (event.type === 'response.completed') {
        yield {
          type: 'usage',
          inputTokens: event.response?.usage?.input_tokens ?? null,
          outputTokens: event.response?.usage?.output_tokens ?? null,
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

  private descriptor(modelId: string, probedAt: string | null): ModelDescriptor {
    return {
      providerId: this.id,
      modelId,
      displayName: modelId,
      capabilities: {
        text: true,
        vision: modelId.includes('gpt-5') ? true : 'unknown',
        tools: true,
        streaming: probedAt ? true : 'unknown',
        structuredOutput: true,
        reasoningControls: modelId.includes('gpt-5') ? true : 'unknown',
      },
      contextWindow: null,
      maxOutputTokens: null,
      probedAt,
    };
  }
}
