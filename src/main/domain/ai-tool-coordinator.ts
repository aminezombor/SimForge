import type {
  ProviderAdapter,
} from '../providers/provider';
import type {
  ProviderEvent,
  ProviderRequest,
} from '../../shared/contracts';
import { ProviderEventSchema } from '../../shared/contracts';
import { assertContract } from '../../shared/validation';

export interface CoordinatedResult {
  events: ProviderEvent[];
  toolResults: Array<{ callId: string; name: string; result: unknown }>;
}

export class AiToolCoordinator {
  async run(
    provider: ProviderAdapter,
    apiKey: string | null,
    request: ProviderRequest,
    allowedTools: ReadonlySet<string>,
    execute: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  ): Promise<CoordinatedResult> {
    const events: ProviderEvent[] = [];
    const toolResults: CoordinatedResult['toolResults'] = [];
    for await (const event of provider.stream(apiKey, request)) {
      assertContract<ProviderEvent>(ProviderEventSchema, event, 'provider event');
      events.push(event);
      if (event.type !== 'tool-call') continue;
      if (!allowedTools.has(event.name)) {
        throw new Error(`Provider requested unavailable tool ${event.name}`);
      }
      toolResults.push({
        callId: event.callId,
        name: event.name,
        result: await execute(event.name, event.arguments),
      });
    }
    return { events, toolResults };
  }
}
