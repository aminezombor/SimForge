import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net, { type Socket } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BlenderBridgeServer,
  type BridgeDescriptor,
} from '../../src/main/bridge/blender-bridge';
import type { BridgeError } from '../../src/main/bridge/blender-bridge';
import { FrameDecoder, writeFrame } from '../../src/main/bridge/framing';
import { ProtocolVersion, type BridgeRequest } from '../../src/shared/contracts';

const sandboxes: string[] = [];
const servers: BlenderBridgeServer[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await server.stop();
  for (const sandbox of sandboxes.splice(0)) await rm(sandbox, { recursive: true, force: true });
});

async function connectClient(
  descriptor: BridgeDescriptor,
  onRequest: (request: BridgeRequest, socket: Socket) => Promise<void>,
): Promise<Socket> {
  const socket = net.createConnection({ host: '127.0.0.1', port: descriptor.port });
  const decoder = new FrameDecoder();
  socket.on('data', (chunk: Buffer) => {
    for (const message of decoder.push(chunk)) {
      const candidate = message as Partial<BridgeRequest>;
      if (candidate.kind === 'request') void onRequest(candidate as BridgeRequest, socket);
    }
  });
  await once(socket, 'connect');
  await writeFrame(socket, {
    protocolVersion: ProtocolVersion,
    kind: 'handshake',
    token: descriptor.token,
    projectId: descriptor.projectId,
    client: 'simforge-blender-extension',
  });
  return socket;
}

async function fixture(options: ConstructorParameters<typeof BlenderBridgeServer>[0] = {}) {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'simforge-bridge-'));
  sandboxes.push(sandbox);
  const runtime = path.join(sandbox, 'runtime');
  const project = path.join(sandbox, 'project');
  const server = new BlenderBridgeServer(options);
  servers.push(server);
  const publicDescriptor = await server.start(runtime, 'project-id', project);
  const descriptorPath = path.join(runtime, `${process.pid}-project-id.json`);
  const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8')) as BridgeDescriptor;
  return { server, descriptor, publicDescriptor };
}

describe('authenticated Blender bridge', () => {
  it('keeps the token private, rejects forged clients, and exchanges revisioned RPC', async () => {
    const { server, descriptor, publicDescriptor } = await fixture();
    expect(publicDescriptor).not.toHaveProperty('token');

    const forged = net.createConnection({ host: '127.0.0.1', port: descriptor.port });
    await once(forged, 'connect');
    await writeFrame(forged, {
      protocolVersion: ProtocolVersion,
      kind: 'handshake',
      token: 'x'.repeat(43),
      projectId: descriptor.projectId,
      client: 'simforge-blender-extension',
    });
    await once(forged, 'close');
    expect(server.connected).toBe(false);

    let revision = 0;
    const connected = once(server, 'connected');
    const client = await connectClient(descriptor, async (request, socket) => {
      if (request.operation !== 'scene.snapshot' && request.expectedSceneRevision !== revision) {
        await writeFrame(socket, {
          protocolVersion: ProtocolVersion,
          kind: 'response',
          requestId: request.requestId,
          ok: false,
          preRevision: revision,
          postRevision: revision,
          changedEntityIds: [],
          warnings: [],
          error: { code: 'STALE_SCENE', message: 'Scene revision changed' },
        });
        return;
      }
      const preRevision = revision;
      if (request.operation === 'object.create_primitive') revision += 1;
      await writeFrame(socket, {
        protocolVersion: ProtocolVersion,
        kind: 'response',
        requestId: request.requestId,
        ok: true,
        preRevision,
        postRevision: revision,
        changedEntityIds: request.operation === 'object.create_primitive' ? ['cube'] : [],
        warnings: [],
        result: request.operation === 'scene.snapshot' ? {
          protocolVersion: ProtocolVersion,
          projectId: descriptor.projectId,
          sceneRevision: revision,
          sceneName: 'Scene',
          blenderFile: null,
          capturedAt: new Date().toISOString(),
          objects: [],
        } : { objectId: 'cube' },
      });
    });
    await connected;
    const snapshot = await server.request('scene.snapshot', {}, null);
    expect(snapshot.preRevision).toBe(0);
    const mutation = await server.request('object.create_primitive', { primitive: 'CUBE' }, 0);
    expect(mutation).toMatchObject({ preRevision: 0, postRevision: 1, changedEntityIds: ['cube'] });
    await expect(server.request('object.create_primitive', {}, 0))
      .rejects.toMatchObject({ code: 'STALE_SCENE' } satisfies Partial<BridgeError>);

    const manualEvent = once(server, 'scene-event');
    await writeFrame(client, {
      protocolVersion: ProtocolVersion,
      kind: 'event',
      eventId: 'manual-1',
      projectId: descriptor.projectId,
      sceneRevision: 2,
      eventType: 'scene.changed',
      changedEntityIds: ['cube'],
      summary: 'Manual Blender edit detected',
    });
    expect((await manualEvent)[0]).toMatchObject({ sceneRevision: 2, changedEntityIds: ['cube'] });
    const disconnected = once(server, 'disconnected');
    client.destroy();
    await disconnected;
  });

  it('accepts a reconnect within the short-lived descriptor window', async () => {
    const { server, descriptor } = await fixture();
    const firstConnected = once(server, 'connected');
    const first = await connectClient(descriptor, async () => Promise.resolve());
    await firstConnected;
    const disconnected = once(server, 'disconnected');
    first.destroy();
    await disconnected;
    const secondConnected = once(server, 'connected');
    const second = await connectClient(descriptor, async () => Promise.resolve());
    await secondConnected;
    expect(server.connected).toBe(true);
    const finalDisconnect = once(server, 'disconnected');
    second.destroy();
    await finalDisconnect;
  });

  it('renews an expiring descriptor while disconnected', async () => {
    const { server, descriptor } = await fixture({
      descriptorTtlMs: 500,
      renewalLeadMs: 100,
      renewalCheckMs: 10,
    });
    const descriptorPath = path.join(
      path.dirname(descriptor.projectRoot),
      'runtime',
      `${process.pid}-project-id.json`,
    );

    let renewed = descriptor;
    await expect.poll(async () => {
      renewed = JSON.parse(await readFile(descriptorPath, 'utf8')) as BridgeDescriptor;
      return renewed.token;
    }, { timeout: 1_000 }).not.toBe(descriptor.token);
    expect(new Date(renewed.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const connected = once(server, 'connected');
    const client = await connectClient(renewed, async () => Promise.resolve());
    await connected;
    expect(server.connected).toBe(true);
    client.destroy();
  });
});
