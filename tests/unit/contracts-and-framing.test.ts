import { describe, expect, it } from 'vitest';
import { FrameDecoder, MAX_FRAME_BYTES, encodeFrame } from '../../src/main/bridge/framing';
import { SceneSnapshotSchema } from '../../src/shared/contracts';
import { sha256, sha256Text } from '../../src/shared/hash';
import { assertContract, ContractError } from '../../src/shared/validation';
import { containsLikelySecret, redactLikelySecrets } from '../../src/main/security/secret-redaction';

describe('shared contracts and bridge framing', () => {
  it('uses stable structural hashes and raw script hashes for different trust boundaries', () => {
    expect(sha256({ b: 2, a: 1 })).toBe(sha256({ a: 1, b: 2 }));
    expect(sha256Text('print(1)')).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256Text('print(1)')).not.toBe(sha256('print(1)'));
  });

  it('decodes fragmented and adjacent length-prefixed messages', () => {
    const combined = Buffer.concat([encodeFrame({ one: 1 }), encodeFrame({ two: 2 })]);
    const decoder = new FrameDecoder();
    expect(decoder.push(combined.subarray(0, 7))).toEqual([]);
    expect(decoder.push(combined.subarray(7))).toEqual([{ one: 1 }, { two: 2 }]);
  });

  it('rejects oversized frames before allocation', () => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(MAX_FRAME_BYTES + 1);
    expect(() => new FrameDecoder().push(header)).toThrow('exceeds size limit');
  });

  it('rejects malformed scene snapshots at the contract boundary', () => {
    expect(() => assertContract(SceneSnapshotSchema, { protocolVersion: 1 }, 'snapshot'))
      .toThrow(ContractError);
  });

  it('detects and redacts high-confidence credentials before persistence', () => {
    const credential = `sk-${'a'.repeat(32)}`;
    expect(containsLikelySecret(`please use ${credential}`)).toBe(true);
    expect(redactLikelySecrets(`please use ${credential}`)).toBe('please use [REDACTED]');
    expect(containsLikelySecret('discuss a robot named Skippy')).toBe(false);
  });
});
