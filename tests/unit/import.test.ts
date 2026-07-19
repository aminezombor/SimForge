import { createHash } from 'node:crypto';
import { access, cp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UrdfImportService } from '../../src/main/import/urdf-import-service';
import type { ImportReport, RobotGraph } from '../../src/shared/contracts';
import { ImportReportSchema, RobotGraphSchema } from '../../src/shared/contracts';
import { assertContract } from '../../src/shared/validation';
import { makeTempProject } from '../helpers/temp-project';

const SAMPLE = path.resolve('sample-data/imports/ros-urdf-tutorial-r2d2');

describe('MS8 licensed URDF staging and conversion', () => {
  it('hash-verifies, contains, converts, and reports the pinned external robot', async () => {
    const fixture = await makeTempProject('Imported robot');
    try {
      const report = await new UrdfImportService(fixture.project, process.cwd()).stageBundledSample();
      expect(() => assertContract<ImportReport>(ImportReportSchema, report, 'ImportReport')).not.toThrow();
      expect(report.status).toBe('STAGED');
      expect(report.source).toMatchObject({
        assetId: 'ros-urdf-tutorial-r2d2-physics',
        format: 'URDF',
        sourceCommit: '050f1e47cfdb2c5f3eb0746bc15c57e6a870faef',
        sourceSha256: '78e6744b67ee07138d370aeea24a6d43d7f7d77025853a995e9685ab41fef047',
        license: 'BSD-3-Clause',
      });
      const graph = report.robotGraph!;
      expect(() => assertContract<RobotGraph>(RobotGraphSchema, graph, 'Imported RobotGraph')).not.toThrow();
      expect(graph.links).toHaveLength(16);
      expect(graph.joints).toHaveLength(15);
      expect(graph.rootLinkId).toBe('base_link');
      expect(graph.links.every((link) => link.massKg.source === 'IMPORTED')).toBe(true);
      expect(graph.links.every((link) => link.inertiaDiagonalKgM2.source === 'IMPORTED')).toBe(true);
      expect(graph.joints.filter((joint) => joint.type !== 'FIXED').every((joint) => joint.drive)).toBe(true);
      expect(report.assets).toHaveLength(2);
      expect(report.assets.every((asset) => asset.contained && !asset.stagedRelativePath.includes('..'))).toBe(true);
      expect(new Set(report.losses.map((entry) => entry.code))).toContain('URDF-MESH-APPROXIMATION');
      expect(report.conversions.map((entry) => entry.code)).toEqual(expect.arrayContaining([
        'URDF-GROUND-NORMALIZATION',
        'URDF-TO-ROBOTGRAPH',
      ]));
      const minimumVisualZ = Math.min(...graph.links.map((link) => link.pose.position[2]));
      expect(minimumVisualZ).toBeGreaterThanOrEqual(0);
      await expect(access(path.join(fixture.project.root, ...report.source.stagedRelativePath.split('/'))))
        .resolves.toBeUndefined();
      for (const asset of report.assets) {
        const data = await readFile(path.join(fixture.project.root, ...asset.stagedRelativePath.split('/')));
        expect(createHash('sha256').update(data).digest('hex')).toBe(asset.sha256);
      }
      expect(new UrdfImportService(fixture.project, process.cwd()).latest()?.importId).toBe(report.importId);
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails closed on XML declarations, remote references, and manifest path traversal', async () => {
    for (const mutation of ['doctype', 'remote', 'traversal'] as const) {
      const fixture = await makeTempProject(`Rejected ${mutation}`);
      try {
        const applicationRoot = path.join(fixture.sandbox, 'application');
        const copied = path.join(applicationRoot, 'sample-data', 'imports', 'ros-urdf-tutorial-r2d2');
        await cp(SAMPLE, copied, { recursive: true });
        const manifestPath = path.join(copied, 'SOURCE.json');
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
          files: Array<{ path: string; bytes: number; sha256: string }>;
        };
        if (mutation === 'traversal') {
          manifest.files.push({ path: '../escape.bin', bytes: 1, sha256: '0'.repeat(64) });
          await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        } else {
          const sourcePath = path.join(copied, '07-physics.urdf');
          let source = await readFile(sourcePath, 'utf8');
          source = mutation === 'doctype'
            ? source.replace('<robot ', '<!DOCTYPE robot [<!ENTITY xxe SYSTEM "file:///windows/win.ini">]>\n<robot ')
            : source.replace('package://urdf_tutorial/meshes/l_finger.dae', 'https://example.invalid/finger.dae');
          await writeFile(sourcePath, source, 'utf8');
          const bytes = Buffer.byteLength(source);
          const sha256 = createHash('sha256').update(source).digest('hex');
          const sourceEntry = manifest.files.find((entry) => entry.path === '07-physics.urdf')!;
          sourceEntry.bytes = bytes;
          sourceEntry.sha256 = sha256;
          await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
        }
        await expect(new UrdfImportService(fixture.project, applicationRoot).stageBundledSample())
          .rejects.toThrow(mutation === 'traversal' ? /contained relative path/ : /forbidden/);
      } finally {
        await fixture.cleanup();
      }
    }
  });
});
