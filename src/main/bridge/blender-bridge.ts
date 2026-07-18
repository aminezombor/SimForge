import { randomBytes, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import net, { type Server, type Socket } from 'node:net';
import path from 'node:path';
import {
  BridgeEventSchema,
  BridgeHandshakeSchema,
  type BridgeEvent,
  type BridgeHandshake,
  type BridgeRequest,
  type BridgeResponse,
  BridgeResponseSchema,
  ProtocolVersion,
} from '../../shared/contracts';
import { assertContract } from '../../shared/validation';
import { protectUserOnlyFile } from '../security/file-protection';
import { FrameDecoder, writeFrame } from './framing';

interface PendingRequest {
  resolve: (response: BridgeResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface BridgeDescriptor {
  protocolVersion: number;
  port: number;
  appPid: number;
  projectId: string;
  projectRoot: string;
  token: string;
  expiresAt: string;
  revisionFloor: number;
}

export interface BlenderBridgeOptions {
  descriptorTtlMs?: number;
  renewalLeadMs?: number;
  renewalCheckMs?: number;
  handshakeTimeoutMs?: number;
}

export class BridgeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.code = code;
  }
}

export class BlenderBridgeServer extends EventEmitter {
  private server: Server | null = null;
  private socket: Socket | null = null;
  private descriptorPath: string | null = null;
  private descriptor: BridgeDescriptor | null = null;
  private descriptorWrite: Promise<void> = Promise.resolve();
  private renewalTimer: NodeJS.Timeout | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly descriptorTtlMs: number;
  private readonly renewalLeadMs: number;
  private readonly renewalCheckMs: number;
  private readonly handshakeTimeoutMs: number;

  constructor(options: BlenderBridgeOptions = {}) {
    super();
    this.descriptorTtlMs = options.descriptorTtlMs ?? 15 * 60_000;
    this.renewalLeadMs = options.renewalLeadMs ?? 2 * 60_000;
    this.renewalCheckMs = options.renewalCheckMs ?? 30_000;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? 30_000;
  }

  get connected(): boolean {
    return Boolean(this.socket && !this.socket.destroyed);
  }

  get projectId(): string | null {
    return this.descriptor?.projectId ?? null;
  }

  async start(
    runtimeDirectory: string,
    projectId: string,
    projectRoot: string,
    revisionFloor = 0,
  ): Promise<Omit<BridgeDescriptor, 'token'>> {
    if (this.server) throw new BridgeError('ALREADY_STARTED', 'Blender bridge is already started');
    await mkdir(runtimeDirectory, { recursive: true });
    const token = randomBytes(32).toString('base64url');
    const server = net.createServer({ pauseOnConnect: false }, (socket) => this.accept(socket));
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
        server.off('error', reject);
        resolve();
      });
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new BridgeError('LISTEN_FAILED', 'Bridge did not receive a TCP port');
    }
    const descriptor: BridgeDescriptor = {
      protocolVersion: ProtocolVersion,
      port: address.port,
      appPid: process.pid,
      projectId,
      projectRoot: path.resolve(projectRoot),
      token,
      expiresAt: new Date(Date.now() + this.descriptorTtlMs).toISOString(),
      revisionFloor,
    };
    this.descriptor = descriptor;
    this.descriptorPath = path.join(runtimeDirectory, `${process.pid}-${projectId}.json`);
    await writeFile(this.descriptorPath, `${JSON.stringify(descriptor, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await protectUserOnlyFile(this.descriptorPath);
    this.renewalTimer = setInterval(() => this.renewDescriptorWhileDisconnected(), this.renewalCheckMs);
    this.renewalTimer.unref();
    return {
      protocolVersion: descriptor.protocolVersion,
      port: descriptor.port,
      appPid: descriptor.appPid,
      projectId: descriptor.projectId,
      projectRoot: descriptor.projectRoot,
      expiresAt: descriptor.expiresAt,
      revisionFloor: descriptor.revisionFloor,
    };
  }

  async request(
    operation: string,
    payload: Record<string, unknown>,
    expectedSceneRevision: number | null,
    timeoutMs = 15_000,
  ): Promise<BridgeResponse> {
    const socket = this.socket;
    const descriptor = this.descriptor;
    if (!socket || socket.destroyed || !descriptor) {
      throw new BridgeError('NOT_CONNECTED', 'Blender is not connected');
    }
    const requestId = randomUUID();
    const request: BridgeRequest = {
      protocolVersion: ProtocolVersion,
      kind: 'request',
      requestId,
      projectId: descriptor.projectId,
      expectedSceneRevision,
      operation,
      payload,
      deadline: new Date(Date.now() + timeoutMs).toISOString(),
    };
    const response = new Promise<BridgeResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new BridgeError('TIMEOUT', `Blender operation ${operation} timed out`));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
    });
    await writeFrame(socket, request);
    return response;
  }

  async stop(): Promise<void> {
    if (this.renewalTimer) clearInterval(this.renewalTimer);
    this.renewalTimer = null;
    this.socket?.destroy();
    this.socket = null;
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new BridgeError('DISCONNECTED', 'Blender bridge stopped'));
      this.pending.delete(requestId);
    }
    const server = this.server;
    this.server = null;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await this.descriptorWrite;
    if (this.descriptorPath) await rm(this.descriptorPath, { force: true });
    this.descriptorPath = null;
    this.descriptor = null;
  }

  private accept(socket: Socket): void {
    if (socket.remoteAddress !== '127.0.0.1' && socket.remoteAddress !== '::ffff:127.0.0.1') {
      socket.destroy();
      return;
    }
    if (this.socket && !this.socket.destroyed) {
      socket.destroy();
      return;
    }
    socket.setNoDelay(true);
    socket.setTimeout(this.handshakeTimeoutMs);
    const decoder = new FrameDecoder();
    let authenticated = false;

    socket.on('data', (chunk: Buffer) => {
      try {
        for (const message of decoder.push(chunk)) {
          if (!authenticated) {
            assertContract<BridgeHandshake>(BridgeHandshakeSchema, message, 'bridge handshake');
            this.authenticate(socket, message);
            authenticated = true;
            socket.setTimeout(0);
            this.socket = socket;
            this.emit('connected');
            void writeFrame(socket, {
              protocolVersion: ProtocolVersion,
              kind: 'handshake-accepted',
              projectId: this.descriptor?.projectId,
            });
            continue;
          }
          this.handleAuthenticatedMessage(message);
        }
      } catch {
        socket.destroy();
      }
    });
    socket.on('timeout', () => socket.destroy());
    socket.on('close', () => {
      if (this.socket === socket) {
        this.socket = null;
        for (const [requestId, pending] of this.pending) {
          clearTimeout(pending.timeout);
          pending.reject(new BridgeError('DISCONNECTED', 'Blender disconnected'));
          this.pending.delete(requestId);
        }
        this.emit('disconnected');
      }
    });
    socket.on('error', () => {
      // The close handler reports the state transition without exposing network details.
    });
  }

  private authenticate(socket: Socket, handshake: BridgeHandshake): void {
    const descriptor = this.descriptor;
    if (
      !descriptor ||
      handshake.token !== descriptor.token ||
      handshake.projectId !== descriptor.projectId ||
      new Date(descriptor.expiresAt).getTime() <= Date.now()
    ) {
      socket.destroy();
      throw new BridgeError('AUTH_FAILED', 'Bridge authentication failed');
    }
  }

  private handleAuthenticatedMessage(message: unknown): void {
    if (this.isResponse(message)) {
      this.updateRevisionFloor(message.postRevision);
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.requestId);
      if (message.ok) pending.resolve(message);
      else {
        pending.reject(
          new BridgeError(message.error?.code ?? 'BLENDER_ERROR', message.error?.message ?? 'Blender error'),
        );
      }
      return;
    }
    assertContract<BridgeEvent>(BridgeEventSchema, message, 'bridge event');
    if (message.projectId !== this.descriptor?.projectId) {
      throw new BridgeError('PROJECT_MISMATCH', 'Bridge event project mismatch');
    }
    this.updateRevisionFloor(message.sceneRevision);
    this.emit('scene-event', message);
  }

  private isResponse(message: unknown): message is BridgeResponse {
    try {
      assertContract<BridgeResponse>(BridgeResponseSchema, message, 'bridge response');
      return true;
    } catch {
      return false;
    }
  }

  private updateRevisionFloor(revision: number): void {
    const descriptor = this.descriptor;
    const descriptorPath = this.descriptorPath;
    if (!descriptor || !descriptorPath || revision <= descriptor.revisionFloor) return;
    descriptor.revisionFloor = revision;
    const serialized = `${JSON.stringify(descriptor, null, 2)}\n`;
    this.descriptorWrite = this.descriptorWrite
      .then(() => writeFile(descriptorPath, serialized, { encoding: 'utf8', mode: 0o600 }))
      .catch(() => {
        // A live session remains authenticated; reconnect will fail closed if persistence fails.
      });
  }

  private renewDescriptorWhileDisconnected(): void {
    const descriptor = this.descriptor;
    const descriptorPath = this.descriptorPath;
    if (
      this.connected ||
      !descriptor ||
      !descriptorPath ||
      new Date(descriptor.expiresAt).getTime() > Date.now() + this.renewalLeadMs
    ) return;

    descriptor.token = randomBytes(32).toString('base64url');
    descriptor.expiresAt = new Date(Date.now() + this.descriptorTtlMs).toISOString();
    const serialized = `${JSON.stringify(descriptor, null, 2)}\n`;
    this.descriptorWrite = this.descriptorWrite
      .then(() => writeFile(descriptorPath, serialized, { encoding: 'utf8', mode: 0o600 }))
      .catch(() => {
        // Reconnect fails closed if the protected descriptor cannot be renewed.
      });
  }
}
