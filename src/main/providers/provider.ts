import type {
  ModelDescriptor,
  ProviderEvent,
  ProviderRequest,
} from '../../shared/contracts';

export interface ProviderProfile {
  id: string;
  provider: 'nvidia' | 'openai' | 'mock';
  endpoint: string;
  secretReference: string | null;
  enabled: boolean;
}

export interface ProviderAdapter {
  readonly id: ProviderProfile['provider'];
  discoverModels(apiKey: string | null, signal?: AbortSignal): Promise<ModelDescriptor[]>;
  probeCapabilities(
    apiKey: string | null,
    modelId: string,
    signal?: AbortSignal,
  ): Promise<ModelDescriptor>;
  stream(
    apiKey: string | null,
    request: ProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent>;
  cancel(requestId: string): void;
}

export class ProviderCancellationRegistry {
  private readonly controllers = new Map<string, AbortController>();

  begin(requestId: string, external?: AbortSignal): AbortSignal {
    const controller = new AbortController();
    this.controllers.set(requestId, controller);
    return external ? AbortSignal.any([external, controller.signal]) : controller.signal;
  }

  cancel(requestId: string): void {
    this.controllers.get(requestId)?.abort();
  }

  complete(requestId: string): void {
    this.controllers.delete(requestId);
  }
}

export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.retryable = retryable;
  }
}

export type FetchLike = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export function requireApiKey(apiKey: string | null, provider: string): string {
  if (!apiKey) {
    throw new ProviderError('CREDENTIAL_REQUIRED', `${provider} credential is not configured`);
  }
  return apiKey;
}

export function providerHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function checkedJson(response: Response, provider: string): Promise<unknown> {
  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new ProviderError(
      `HTTP_${response.status}`,
      `${provider} request failed with HTTP ${response.status}`,
      retryable,
    );
  }
  return response.json() as Promise<unknown>;
}

export async function* parseServerSentEvents(response: Response): AsyncIterable<unknown> {
  if (!response.ok || !response.body) {
    throw new ProviderError(
      `HTTP_${response.status}`,
      `Streaming request failed with HTTP ${response.status}`,
      response.status === 429 || response.status >= 500,
    );
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    for (const event of events) {
      for (const line of event.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        yield JSON.parse(payload) as unknown;
      }
    }
  }
}
