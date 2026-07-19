import type { ModelDescriptor } from '../../shared/contracts';
import type { WorkspaceSettings } from '../../shared/desktop-api';
import type { CloudProviderId, ProviderService } from './provider-service';

export type RoutingPurpose =
  | 'conversation'
  | 'planning'
  | 'blender-scripting'
  | 'vision-review'
  | 'summarization'
  | 'validation-review';

type Capability = 'text' | 'vision' | 'tools' | 'streaming' | 'reasoningControls';

export interface ModelRoute {
  providerId: 'local' | CloudProviderId;
  modelId: string;
  reason: string;
  fallback: boolean;
  capabilities: ModelDescriptor['capabilities'];
}

const LOCAL_MODEL: ModelDescriptor = {
  providerId: 'local',
  modelId: 'mock-planner',
  displayName: 'Local deterministic fixture',
  capabilities: {
    text: true,
    vision: false,
    tools: true,
    streaming: true,
    structuredOutput: true,
    reasoningControls: false,
  },
  contextWindow: 32_000,
  maxOutputTokens: 4_000,
  probedAt: 'local',
};

export class ModelRouter {
  constructor(private readonly providers: ProviderService) {}

  async select(
    settings: WorkspaceSettings,
    purpose: RoutingPurpose,
    required: Capability[],
  ): Promise<ModelRoute> {
    if (settings.routingMode === 'manual') {
      return this.manual(settings, purpose, required);
    }
    const order = unique([settings.activeProvider, ...settings.fallbackOrder]);
    const skipped: string[] = [];
    for (const providerId of order) {
      if (providerId === 'local') {
        if (supports(LOCAL_MODEL, required)) {
          return {
            providerId: 'local',
            modelId: LOCAL_MODEL.modelId,
            capabilities: LOCAL_MODEL.capabilities,
            fallback: settings.activeProvider !== 'local',
            reason: settings.activeProvider === 'local'
              ? `Automatic ${purpose} route selected the local fixture; all required capabilities are available locally`
              : `Automatic ${purpose} route fell back to the local fixture after ${skipped.join('; ') || 'cloud routes were unavailable'}`,
          };
        }
        skipped.push('local lacks required capabilities');
        continue;
      }
      if (!settings.enabledProviders[providerId]) {
        skipped.push(`${providerId} is disabled`);
        continue;
      }
      if (!settings.cloudProcessing) {
        skipped.push('cloud processing is disabled');
        continue;
      }
      if (settings.monthlyBudgetUsd === 0) {
        skipped.push('cloud budget is zero');
        continue;
      }
      const status = await this.providers.status(providerId);
      if (!status.configured) {
        skipped.push(`${providerId} is not configured`);
        continue;
      }
      const models = this.providers.storedModels(providerId)
        .filter((model) => model.probedAt !== null && supports(model, required))
        .sort((left, right) => score(right, purpose, settings) - score(left, purpose, settings));
      const selected = models[0];
      if (!selected) {
        skipped.push(`${providerId} has no probed compatible model`);
        continue;
      }
      return {
        providerId,
        modelId: selected.modelId,
        capabilities: selected.capabilities,
        fallback: providerId !== settings.activeProvider || selected.modelId !== settings.activeModel,
        reason: `Automatic ${purpose} route selected ${providerId}/${selected.modelId}: runtime-probed ${required.join(' + ')} capabilities matched`,
      };
    }
    throw new Error(`No model route satisfies ${required.join(' + ')} for ${purpose}. ${skipped.join('; ')}`);
  }

  private async manual(
    settings: WorkspaceSettings,
    purpose: RoutingPurpose,
    required: Capability[],
  ): Promise<ModelRoute> {
    if (settings.activeProvider === 'local') {
      if (!supports(LOCAL_MODEL, required)) throw new Error(`Local model cannot perform ${purpose}`);
      return {
        providerId: 'local', modelId: LOCAL_MODEL.modelId, capabilities: LOCAL_MODEL.capabilities,
        fallback: false, reason: `Manual route selected local/${LOCAL_MODEL.modelId} for ${purpose}`,
      };
    }
    const providerId = settings.activeProvider;
    if (!settings.enabledProviders[providerId]) throw new Error(`${providerId} is disabled in Provider Settings`);
    if (!settings.cloudProcessing) throw new Error('Cloud processing is disabled in Privacy Settings');
    if (settings.monthlyBudgetUsd === 0) throw new Error('The cloud provider budget is zero');
    const status = await this.providers.status(providerId);
    if (!status.configured) throw new Error(`${providerId} is not configured`);
    const model = this.providers.storedModels(providerId)
      .find((entry) => entry.modelId === settings.activeModel && entry.probedAt !== null);
    if (!model) throw new Error(`${settings.activeModel} must be discovered and probed before manual use`);
    if (!supports(model, required)) throw new Error(`${settings.activeModel} lacks required ${required.join(' + ')} capabilities`);
    return {
      providerId, modelId: model.modelId, capabilities: model.capabilities, fallback: false,
      reason: `Manual route selected ${providerId}/${model.modelId} for ${purpose}; runtime probe confirms ${required.join(' + ')}`,
    };
  }
}

function supports(model: ModelDescriptor, required: Capability[]): boolean {
  return required.every((capability) => model.capabilities[capability] === true);
}

function unique(values: Array<'local' | CloudProviderId>): Array<'local' | CloudProviderId> {
  return [...new Set(values)];
}

function score(model: ModelDescriptor, purpose: RoutingPurpose, settings: WorkspaceSettings): number {
  const id = model.modelId.toLowerCase();
  let value = model.modelId === settings.activeModel ? 500 : 0;
  if (model.providerId === settings.activeProvider) value += 200;
  if (id.includes('nemotron-3-ultra')) value += purpose === 'vision-review' ? 0 : 100;
  if (id.includes('gpt-5')) value += 80;
  if (purpose === 'vision-review' && model.capabilities.vision === true) value += 300;
  if (['planning', 'blender-scripting', 'validation-review'].includes(purpose) && model.capabilities.tools === true) value += 40;
  if (['planning', 'validation-review'].includes(purpose) && model.capabilities.reasoningControls === true) value += 30;
  return value;
}
