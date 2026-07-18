import type { Socket } from 'node:net';

export const MAX_FRAME_BYTES = 1_048_576;

export function encodeFrame(value: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  if (payload.byteLength > MAX_FRAME_BYTES) {
    throw new Error('Bridge frame exceeds size limit');
  }
  const header = Buffer.allocUnsafe(4);
  header.writeUInt32BE(payload.byteLength, 0);
  return Buffer.concat([header, payload]);
}
export class FrameDecoder {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): unknown[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: unknown[] = [];
    while (this.buffer.byteLength >= 4) {
      const size = this.buffer.readUInt32BE(0);
      if (size > MAX_FRAME_BYTES) {
        throw new Error('Bridge frame exceeds size limit');
      }
      if (this.buffer.byteLength < 4 + size) break;
      const payload = this.buffer.subarray(4, 4 + size).toString('utf8');
      this.buffer = this.buffer.subarray(4 + size);
      messages.push(JSON.parse(payload) as unknown);
    }
    return messages;
  }
}

export function writeFrame(socket: Socket, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(encodeFrame(value), (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
