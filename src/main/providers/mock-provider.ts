import type {
  ModelDescriptor,
  ProviderEvent,
  ProviderRequest,
} from '../../shared/contracts';
import type { ProviderAdapter } from './provider';

export class MockProviderAdapter implements ProviderAdapter {
  readonly id = 'mock' as const;
  readonly calls: ProviderRequest[] = [];
  private readonly cancelled = new Set<string>();

  cancel(requestId: string): void {
    this.cancelled.add(requestId);
  }

  async discoverModels(): Promise<ModelDescriptor[]> {
    return [await this.probeCapabilities(null, 'mock-planner')];
  }

  async probeCapabilities(
    _apiKey: string | null,
    modelId: string,
  ): Promise<ModelDescriptor> {
    await Promise.resolve();
    return {
      providerId: this.id,
      modelId,
      displayName: 'Deterministic test provider',
      capabilities: {
        text: true,
        vision: false,
        tools: true,
        streaming: true,
        structuredOutput: true,
        reasoningControls: false,
      },
      contextWindow: 32_768,
      maxOutputTokens: 4_096,
      probedAt: new Date().toISOString(),
    };
  }

  async *stream(
    _apiKey: string | null,
    request: ProviderRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ProviderEvent> {
    await Promise.resolve();
    if (signal?.aborted || this.cancelled.delete(request.requestId)) {
      yield { type: 'warning', message: 'Request cancelled' };
      return;
    }
    this.calls.push(request);
    yield { type: 'text-delta', text: 'Ready to inspect the live scene.' };
    if (request.tools[0]) {
      yield {
        type: 'tool-call',
        callId: 'mock-tool-call',
        name: request.tools[0].name,
        arguments: {},
      };
    }
    yield { type: 'usage', inputTokens: 12, outputTokens: 7 };
    yield { type: 'completed' };
  }
}
