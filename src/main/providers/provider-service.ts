import type { ModelDescriptor } from '../../shared/contracts';
import type { ActivityService } from '../domain/activity-service';
import type { CredentialStore } from '../security/credential-store';
import { NvidiaProviderAdapter } from './nvidia-provider';
import { OpenAIProviderAdapter } from './openai-provider';
import type { ProviderAdapter } from './provider';

export type CloudProviderId = 'nvidia' | 'openai';

export interface ProviderStatus {
  providerId: CloudProviderId;
  configured: boolean;
  discoveredModels: number;
  lastError: string | null;
}

export interface ProviderProbeResult {
  model: ModelDescriptor;
  selectionReason: string;
  disclosure: {
    providerId: CloudProviderId;
    modelId: string;
    purpose: string;
    dataClasses: string[];
    attachments: string[];
  };
}

interface StateRepository {
  setState(key: string, value: unknown): void;
  getState<T>(key: string): T | null;
}

export class ProviderService {
  private readonly adapters: Record<CloudProviderId, ProviderAdapter>;

  constructor(
    private readonly credentials: CredentialStore,
    private readonly repository: StateRepository,
    private readonly activities: ActivityService,
    adapters?: Partial<Record<CloudProviderId, ProviderAdapter>>,
  ) {
    this.adapters = {
      nvidia: adapters?.nvidia ?? new NvidiaProviderAdapter(),
      openai: adapters?.openai ?? new OpenAIProviderAdapter(),
    };
  }

  async configure(providerId: CloudProviderId, secret: string): Promise<ProviderStatus> {
    if (secret.trim().length < 8) throw new Error('Provider credential is too short');
    await this.credentials.set(this.reference(providerId), secret.trim());
    this.repository.setState(`provider:${providerId}:lastError`, null);
    this.activities.record('provider', 'credential-configured', `${providerId} credential configured`);
    return this.status(providerId);
  }

  async remove(providerId: CloudProviderId): Promise<ProviderStatus> {
    await this.credentials.delete(this.reference(providerId));
    this.repository.setState(`provider:${providerId}:models`, []);
    this.activities.record('provider', 'credential-removed', `${providerId} credential removed`);
    return this.status(providerId);
  }

  async status(providerId: CloudProviderId): Promise<ProviderStatus> {
    const configured = Boolean(await this.credentials.get(this.reference(providerId)));
    const models = this.repository.getState<ModelDescriptor[]>(`provider:${providerId}:models`) ?? [];
    return {
      providerId,
      configured,
      discoveredModels: models.length,
      lastError: this.repository.getState<string>(`provider:${providerId}:lastError`),
    };
  }

  async discover(providerId: CloudProviderId): Promise<ModelDescriptor[]> {
    try {
      const models = await this.adapters[providerId].discoverModels(await this.secret(providerId));
      this.repository.setState(`provider:${providerId}:models`, models);
      this.repository.setState(`provider:${providerId}:lastError`, null);
      this.activities.record('provider', 'models-discovered', `${providerId} models discovered`, {
        count: models.length,
      });
      return models;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider discovery failed';
      this.repository.setState(`provider:${providerId}:lastError`, message);
      this.activities.record('provider', 'discovery-failed', `${providerId} model discovery failed`, {
        error: message,
      });
      throw error;
    }
  }

  async probe(providerId: CloudProviderId, modelId: string): Promise<ProviderProbeResult> {
    let discovered = this.repository.getState<ModelDescriptor[]>(`provider:${providerId}:models`) ?? [];
    if (!discovered.some((model) => model.modelId === modelId)) {
      discovered = await this.discover(providerId);
    }
    if (!discovered.some((model) => model.modelId === modelId)) {
      throw new Error(`${modelId} was not returned by runtime ${providerId} discovery`);
    }
    const purpose = 'Non-mutating text capability probe';
    const model = await this.adapters[providerId].probeCapabilities(
      await this.secret(providerId),
      modelId,
    );
    const models = discovered.map((entry) => entry.modelId === modelId ? model : entry);
    this.repository.setState(`provider:${providerId}:models`, models);
    const result: ProviderProbeResult = {
      model,
      selectionReason: `${providerId}/${modelId} was discovered at runtime and passed a text streaming probe`,
      disclosure: {
        providerId,
        modelId,
        purpose,
        dataClasses: ['probe prompt'],
        attachments: [],
      },
    };
    this.activities.record('provider', 'capability-probed', result.selectionReason, {
      providerId,
      modelId,
      purpose,
      dataClasses: result.disclosure.dataClasses,
      attachments: [],
    });
    return result;
  }

  private async secret(providerId: CloudProviderId): Promise<string | null> {
    return this.credentials.get(this.reference(providerId));
  }

  private reference(providerId: CloudProviderId): string {
    return `${providerId}.api-key`;
  }
}
