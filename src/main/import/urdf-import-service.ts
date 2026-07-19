import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
} from 'node:fs/promises';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type {
  ImportReport,
  RobotGeometry,
  RobotGraph,
  RobotJoint,
  RobotLink,
  RobotMaterial,
} from '../../shared/contracts';
import { ImportReportSchema, RobotGraphSchema } from '../../shared/contracts';
import { assertContract } from '../../shared/validation';
import type { ProjectHandle } from '../storage/project-repository';

const MAX_URDF_BYTES = 1_000_000;
const MAX_LINKS = 256;
const MAX_JOINTS = 256;
const SAMPLE_RELATIVE_ROOT = 'sample-data/imports/ros-urdf-tutorial-r2d2';
const SOURCE_MANIFEST_FILES = [
  '07-physics.urdf',
  'LICENSE',
  'meshes/l_finger.dae',
  'meshes/l_finger_tip.dae',
] as const;

type UnknownRecord = Record<string, unknown>;
type Vector3 = [number, number, number];
type Matrix3 = [number, number, number, number, number, number, number, number, number];
interface Transform { position: Vector3; rotation: Matrix3 }

interface SourceManifest {
  assetId: string;
  name: string;
  sourceRepository: string;
  sourceCommit: string;
  sourcePath: string;
  license: string;
  attribution: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
}

interface ConvertedUrdf {
  robotGraph: RobotGraph;
  assets: ImportReport['assets'];
  conversions: ImportReport['conversions'];
  losses: ImportReport['losses'];
  assumptions: string[];
  warnings: string[];
}

export class UrdfImportService {
  constructor(
    private readonly project: ProjectHandle,
    private readonly applicationRoot: string,
  ) {}

  latest(): ImportReport | null {
    const record = [...this.project.repository.listProjectRecords(this.project.manifest.projectId)]
      .reverse()
      .find((candidate) => candidate.kind === 'asset' && candidate.body.type === 'import-report');
    if (!record) return null;
    assertContract<ImportReport>(ImportReportSchema, record.body.report, 'stored import report');
    return record.body.report;
  }

  async stageBundledSample(): Promise<ImportReport> {
    const sourceRoot = path.resolve(this.applicationRoot, ...SAMPLE_RELATIVE_ROOT.split('/'));
    const manifest = await this.readSourceManifest(sourceRoot);
    const verifiedFiles = await this.verifySourceFiles(sourceRoot, manifest);
    const source = verifiedFiles.get('07-physics.urdf');
    if (!source) throw new Error('Bundled URDF source is absent from the verified manifest');
    const text = await readFile(source.absolute, 'utf8');
    const importId = randomUUID();
    const stageRoot = path.resolve(this.project.root, 'references', 'imports', importId);
    this.assertWithin(this.project.root, stageRoot);
    await mkdir(path.join(stageRoot, 'meshes'), { recursive: true });
    for (const relative of SOURCE_MANIFEST_FILES) {
      const verified = verifiedFiles.get(relative);
      if (!verified) throw new Error(`Verified sample file is missing: ${relative}`);
      const target = path.resolve(stageRoot, ...relative.split('/'));
      this.assertWithin(stageRoot, target);
      await copyFile(verified.absolute, target);
    }
    const sourceManifestPath = path.resolve(sourceRoot, 'SOURCE.json');
    await copyFile(sourceManifestPath, path.join(stageRoot, 'SOURCE.json'));

    const converted = this.convert(text, sourceRoot, stageRoot, manifest, verifiedFiles);
    const now = new Date().toISOString();
    const report: ImportReport = {
      schemaVersion: 1,
      importId,
      projectId: this.project.manifest.projectId,
      status: 'STAGED',
      source: {
        assetId: manifest.assetId,
        name: manifest.name,
        format: 'URDF',
        sourceRepository: manifest.sourceRepository,
        sourceCommit: manifest.sourceCommit,
        sourcePath: manifest.sourcePath,
        sourceSha256: source.sha256,
        sourceBytes: source.bytes,
        stagedRelativePath: projectRelative(this.project.root, path.join(stageRoot, '07-physics.urdf')),
        license: manifest.license,
        attribution: manifest.attribution,
      },
      ...converted,
      stagedObjectCount: converted.robotGraph.links.length,
      materializedSceneRevision: null,
      modification: null,
      createdAt: now,
      updatedAt: now,
    };
    assertContract<ImportReport>(ImportReportSchema, report, 'staged URDF import report');
    this.save(report);
    return report;
  }

  markMaterialized(report: ImportReport, sceneRevision: number): ImportReport {
    const updated: ImportReport = {
      ...report,
      status: 'MATERIALIZED',
      materializedSceneRevision: sceneRevision,
      updatedAt: new Date().toISOString(),
    };
    this.save(updated);
    return updated;
  }

  markModified(
    report: ImportReport,
    graph: RobotGraph,
    sceneRevision: number,
    summary: string,
  ): ImportReport {
    const updated: ImportReport = {
      ...report,
      status: 'MODIFIED',
      robotGraph: graph,
      materializedSceneRevision: sceneRevision,
      modification: { kind: 'ADD_SENSOR', summary, sceneRevision },
      updatedAt: new Date().toISOString(),
    };
    this.save(updated);
    return updated;
  }

  private save(report: ImportReport): void {
    assertContract<ImportReport>(ImportReportSchema, report, 'import report');
    this.project.repository.saveProjectRecord({
      id: `import-report:${report.importId}:${report.status}:${report.updatedAt}`,
      projectId: this.project.manifest.projectId,
      kind: 'asset',
      body: { type: 'import-report', report },
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    });
  }

  private async readSourceManifest(sourceRoot: string): Promise<SourceManifest> {
    const value = JSON.parse(await readFile(path.resolve(sourceRoot, 'SOURCE.json'), 'utf8')) as unknown;
    const manifest = record(value, 'SOURCE.json');
    const files = array(manifest.files).map((entry) => {
      const file = record(entry, 'SOURCE.json file');
      return {
        path: string(file.path, 'source file path'),
        bytes: positiveInteger(file.bytes, 'source file bytes'),
        sha256: sha256Value(file.sha256, 'source file sha256'),
      };
    });
    const result: SourceManifest = {
      assetId: string(manifest.assetId, 'asset ID'),
      name: string(manifest.name, 'asset name'),
      sourceRepository: string(manifest.sourceRepository, 'source repository'),
      sourceCommit: string(manifest.sourceCommit, 'source commit'),
      sourcePath: string(manifest.sourcePath, 'source path'),
      license: string(manifest.license, 'source license'),
      attribution: string(manifest.attribution, 'source attribution'),
      files,
    };
    if (result.license !== 'BSD-3-Clause' || !/^[a-f0-9]{40}$/.test(result.sourceCommit)) {
      throw new Error('Bundled sample provenance is not pinned to the reviewed license/commit');
    }
    return result;
  }

  private async verifySourceFiles(
    sourceRoot: string,
    manifest: SourceManifest,
  ): Promise<Map<string, { absolute: string; bytes: number; sha256: string }>> {
    const expected = new Map(manifest.files.map((entry) => [normalizeRelative(entry.path), entry]));
    for (const required of SOURCE_MANIFEST_FILES) {
      if (!expected.has(required)) throw new Error(`SOURCE.json omits required file: ${required}`);
    }
    const verified = new Map<string, { absolute: string; bytes: number; sha256: string }>();
    for (const [relative, entry] of expected) {
      const absolute = path.resolve(sourceRoot, ...relative.split('/'));
      this.assertWithin(sourceRoot, absolute);
      const stats = await lstat(absolute);
      if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Import source is not a regular file: ${relative}`);
      const digest = await fileSha256(absolute);
      if (stats.size !== entry.bytes || digest !== entry.sha256) {
        throw new Error(`Bundled import source failed size/hash verification: ${relative}`);
      }
      verified.set(relative, { absolute, bytes: stats.size, sha256: digest });
    }
    return verified;
  }

  private convert(
    text: string,
    sourceRoot: string,
    stageRoot: string,
    manifest: SourceManifest,
    verifiedFiles: Map<string, { absolute: string; bytes: number; sha256: string }>,
  ): ConvertedUrdf {
    if (Buffer.byteLength(text, 'utf8') > MAX_URDF_BYTES) throw new Error('URDF exceeds the one-megabyte import limit');
    if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet|<xacro:|xmlns:xacro|\$\(|https?:\/\//i.test(text)) {
      throw new Error('URDF contains a forbidden declaration, macro, command substitution, or remote URL');
    }
    const validation = XMLValidator.validate(text, { allowBooleanAttributes: false });
    if (validation !== true) throw new Error('URDF XML is malformed');
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      allowBooleanAttributes: false,
      processEntities: false,
      trimValues: true,
    }).parse(text) as unknown;
    const robot = record(record(parsed, 'URDF document').robot, 'URDF robot');
    const rawLinks = array(robot.link);
    const rawJoints = array(robot.joint);
    if (!rawLinks.length || rawLinks.length > MAX_LINKS || rawJoints.length > MAX_JOINTS) {
      throw new Error('URDF link/joint count is outside the safe supported range');
    }
    const conversions: ImportReport['conversions'] = [];
    const losses: ImportReport['losses'] = [];
    const warnings: string[] = [];
    const assetMap = new Map<string, ImportReport['assets'][number]>();
    const materialByName = this.convertMaterials(robot);
    const linksByName = new Map(rawLinks.map((entry) => {
      const link = record(entry, 'URDF link');
      return [string(link.name, 'URDF link name'), link] as const;
    }));
    if (linksByName.size !== rawLinks.length) throw new Error('URDF link names must be unique');
    const joints = rawJoints.map((entry) => this.rawJoint(record(entry, 'URDF joint')));
    if (new Set(joints.map((joint) => joint.id)).size !== joints.length) throw new Error('URDF joint names must be unique');
    const children = new Set(joints.map((joint) => joint.childLinkId));
    const roots = [...linksByName.keys()].filter((name) => !children.has(name));
    if (roots.length !== 1) throw new Error('URDF must contain exactly one root link');
    const rootLinkId = roots[0]!;
    const frames = computeFrames(rootLinkId, linksByName, joints);

    const pendingLinks: Array<{ link: RobotLink; collisionMinimumZ: number }> = [];
    for (const [linkName, rawLink] of linksByName) {
      const visualEntries = array(rawLink.visual);
      const collisionEntries = array(rawLink.collision);
      if (!visualEntries.length) throw new Error(`URDF link has no visual geometry: ${linkName}`);
      if (visualEntries.length > 1) {
        losses.push(loss('URDF-MULTI-VISUAL-TRUNCATED', `/links/${escapePath(linkName)}`, 'Only the first visual element is represented in RobotGraph.'));
      }
      if (collisionEntries.length > 1) {
        losses.push(loss('URDF-MULTI-COLLISION-TRUNCATED', `/links/${escapePath(linkName)}`, 'Only the first collision element is represented in RobotGraph.'));
      }
      const visualEntry = record(visualEntries[0], `visual for ${linkName}`);
      const collisionEntry = collisionEntries.length ? record(collisionEntries[0], `collision for ${linkName}`) : null;
      const visual = this.geometry(
        record(visualEntry.geometry, `visual geometry for ${linkName}`),
        `/links/${escapePath(linkName)}/visual`,
        sourceRoot,
        stageRoot,
        verifiedFiles,
        assetMap,
        losses,
      );
      const collision = collisionEntry
        ? this.geometry(
          record(collisionEntry.geometry, `collision geometry for ${linkName}`),
          `/links/${escapePath(linkName)}/collision`,
          sourceRoot,
          stageRoot,
          verifiedFiles,
          assetMap,
          losses,
        )
        : null;
      const linkFrame = frames.get(linkName);
      if (!linkFrame) throw new Error(`URDF link is unreachable from root: ${linkName}`);
      const visualOrigin = origin(visualEntry.origin);
      const visualTransform = compose(linkFrame, visualOrigin);
      if (collisionEntry) {
        const collisionOrigin = origin(collisionEntry.origin);
        if (!sameTransform(visualOrigin, collisionOrigin)) {
          conversions.push(conversion(
            'URDF-COLLISION-ORIGIN-FLATTENED',
            `/links/${escapePath(linkName)}/collision`,
            'Collision origin was flattened to the visual pose because RobotGraph v1 has one link pose.',
          ));
        }
      }
      const inertial = rawLink.inertial ? record(rawLink.inertial, `inertial for ${linkName}`) : null;
      const mass = inertial ? number(record(inertial.mass, 'URDF mass').value, 'URDF mass value') : null;
      const inertia = inertial ? record(inertial.inertia, 'URDF inertia') : null;
      const inertiaDiagonal: Vector3 | null = inertia
        ? [number(inertia.ixx, 'ixx'), number(inertia.iyy, 'iyy'), number(inertia.izz, 'izz')]
        : null;
      if (inertia && [inertia.ixy, inertia.ixz, inertia.iyz].some((value) => Math.abs(number(value, 'off-diagonal inertia')) > 1e-12)) {
        losses.push(loss('URDF-INERTIA-OFFDIAGONAL-OMITTED', `/links/${escapePath(linkName)}/inertia`, 'RobotGraph v1 retains the imported diagonal and reports non-zero products of inertia as loss.'));
      }
      const inertialOrigin = inertial ? origin(inertial.origin).position : null;
      const materialName = visualEntry.material
        ? string(record(visualEntry.material, 'URDF visual material').name, 'URDF material reference')
        : 'imported-default';
      const materialId = materialByName.has(materialName) ? `imported-${materialName}` : 'imported-default';
      if (!materialByName.has(materialName)) warnings.push(`Link ${linkName} uses the imported-default material.`);
      const link: RobotLink = {
        id: linkName,
        name: humanize(linkName),
        pose: { position: visualTransform.position, rotationEuler: matrixToEuler(visualTransform.rotation) },
        visual,
        collision,
        materialId,
        physicsMaterialId: materialId,
        massKg: { value: mass, source: mass === null ? 'UNKNOWN' : 'IMPORTED', note: mass === null ? 'URDF did not declare mass.' : 'Imported from URDF inertial/mass.' },
        centerOfMassM: { value: inertialOrigin, source: inertial ? 'IMPORTED' : 'UNKNOWN', note: inertial ? 'Imported from URDF inertial origin.' : 'URDF did not declare an inertial origin.' },
        inertiaDiagonalKgM2: { value: inertiaDiagonal, source: inertiaDiagonal ? 'IMPORTED' : 'UNKNOWN', note: inertiaDiagonal ? 'Imported URDF inertia diagonal; off-diagonal terms are reported separately.' : 'URDF did not declare inertia.' },
        dynamic: true,
      };
      pendingLinks.push({
        link,
        collisionMinimumZ: collision ? minimumZ(visualTransform, collision) : minimumZ(visualTransform, visual),
      });
    }
    const minimumCollisionZ = Math.min(...pendingLinks.map((entry) => entry.collisionMinimumZ));
    const supportOffset = minimumCollisionZ < 0 ? -minimumCollisionZ : 0;
    if (supportOffset > 0) {
      conversions.push(conversion('URDF-GROUND-NORMALIZATION', '/robot', `Translated the imported robot +${supportOffset.toFixed(6)} m on Z so collision geometry contacts the project support plane.`));
    }
    const links = pendingLinks.map(({ link }) => ({
      ...link,
      pose: {
        ...link.pose,
        position: [link.pose.position[0], link.pose.position[1], link.pose.position[2] + supportOffset] as Vector3,
      },
    }));
    const graphJoints: RobotJoint[] = joints.map((joint) => {
      const childFrame = frames.get(joint.childLinkId);
      if (!childFrame) throw new Error(`URDF joint child is unreachable: ${joint.childLinkId}`);
      return {
        ...joint,
        origin: {
          position: [childFrame.position[0], childFrame.position[1], childFrame.position[2] + supportOffset],
          rotationEuler: matrixToEuler(childFrame.rotation),
        },
      };
    });
    const materials: RobotMaterial[] = [
      ...materialByName.values(),
      { id: 'imported-default', name: 'Imported Default', baseColor: [0.45, 0.52, 0.58, 1], metallic: 0.08, roughness: 0.5 },
      { id: 'sensor-amber', name: 'Imported Sensor Amber', baseColor: [0.95, 0.34, 0.045, 1], metallic: 0.08, roughness: 0.34 },
      { id: 'collision-guide', name: 'Imported Collision Guide', baseColor: [0.08, 0.75, 0.95, 0.18], metallic: 0, roughness: 0.55 },
    ];
    const graph: RobotGraph = {
      schemaVersion: 1,
      robotId: `imported-${slug(manifest.assetId)}-${verifiedFiles.get('07-physics.urdf')!.sha256.slice(0, 12)}`,
      name: `${manifest.name} (Imported)`,
      units: 'meters-kilograms-radians',
      coordinateConvention: 'right-handed-z-up-x-forward',
      rootLinkId,
      selfCollision: {
        policy: 'ADJACENT_EXCLUDED',
        note: 'Imported URDF has no complete self-collision matrix; adjacent exclusions require downstream review.',
      },
      materials,
      links,
      joints: graphJoints,
      sensors: [],
      assumptions: [
        'URDF units are interpreted as meters, kilograms, and radians.',
        'COLLADA finger meshes are retained as contained source assets but approximated by explicit box primitives.',
        'RobotGraph v1 flattens visual/collision origins and full inertia tensors with every loss reported.',
        'The import is translated only on Z so its collision representation contacts the selected Z=0 support plane.',
      ],
    };
    assertContract<RobotGraph>(RobotGraphSchema, graph, 'converted URDF RobotGraph');
    conversions.push(conversion('URDF-TO-ROBOTGRAPH', '/robot', `Converted ${links.length} links and ${graphJoints.length} joints into RobotGraph v1.`));
    return {
      robotGraph: graph,
      assets: [...assetMap.values()].sort((left, right) => left.originalReference.localeCompare(right.originalReference)),
      conversions,
      losses,
      assumptions: graph.assumptions,
      warnings: [...new Set(warnings)].sort(),
    };
  }

  private convertMaterials(robot: UnknownRecord): Map<string, RobotMaterial> {
    const result = new Map<string, RobotMaterial>();
    for (const entry of array(robot.material)) {
      const material = record(entry, 'URDF material');
      const name = string(material.name, 'URDF material name');
      const color = material.color ? vector(record(material.color, 'URDF color').rgba, 4, 'URDF rgba') : [0.5, 0.5, 0.5, 1];
      result.set(name, {
        id: `imported-${name}`,
        name: `Imported ${humanize(name)}`,
        baseColor: color as [number, number, number, number],
        metallic: 0,
        roughness: 0.55,
      });
    }
    return result;
  }

  private rawJoint(value: UnknownRecord): RobotJoint {
    const id = string(value.name, 'URDF joint name');
    const rawType = string(value.type, 'URDF joint type').toUpperCase();
    if (!['FIXED', 'REVOLUTE', 'CONTINUOUS', 'PRISMATIC'].includes(rawType)) {
      throw new Error(`Unsupported URDF joint type: ${rawType}`);
    }
    const type = rawType as RobotJoint['type'];
    const parentLinkId = string(record(value.parent, 'URDF joint parent').link, 'URDF parent link');
    const childLinkId = string(record(value.child, 'URDF joint child').link, 'URDF child link');
    const frame = origin(value.origin);
    const axis = type === 'FIXED' ? [0, 0, 0] as Vector3 : vector(recordOrEmpty(value.axis).xyz ?? '1 0 0', 3, 'URDF joint axis') as Vector3;
    const limit = value.limit ? record(value.limit, 'URDF joint limit') : null;
    const requiresLimits = type === 'REVOLUTE' || type === 'PRISMATIC';
    if (requiresLimits && !limit) throw new Error(`URDF joint ${id} requires limits`);
    const effort = limit ? number(limit.effort ?? 1, 'URDF joint effort') : 1;
    return {
      id,
      name: humanize(id),
      type,
      parentLinkId,
      childLinkId,
      origin: { position: frame.position, rotationEuler: matrixToEuler(frame.rotation) },
      axis,
      limits: requiresLimits && limit
        ? { lower: number(limit.lower, 'URDF lower limit'), upper: number(limit.upper, 'URDF upper limit'), effort: Math.max(effort, 1e-6) }
        : null,
      drive: type === 'FIXED' ? null : { mode: type === 'CONTINUOUS' ? 'VELOCITY' : 'POSITION', maxForce: Math.max(effort, 1e-6) },
    };
  }

  private geometry(
    value: UnknownRecord,
    entityPath: string,
    sourceRoot: string,
    stageRoot: string,
    verifiedFiles: Map<string, { absolute: string; bytes: number; sha256: string }>,
    assets: Map<string, ImportReport['assets'][number]>,
    losses: ImportReport['losses'],
  ): RobotGeometry {
    if (value.box) return { primitive: 'BOX', size: vector(record(value.box, 'URDF box').size, 3, 'URDF box size') as Vector3 };
    if (value.cylinder) {
      const cylinder = record(value.cylinder, 'URDF cylinder');
      return { primitive: 'CYLINDER', radius: positive(cylinder.radius, 'URDF cylinder radius'), depth: positive(cylinder.length, 'URDF cylinder length') };
    }
    if (value.sphere) return { primitive: 'SPHERE', radius: positive(record(value.sphere, 'URDF sphere').radius, 'URDF sphere radius') };
    if (value.mesh) {
      const reference = string(record(value.mesh, 'URDF mesh').filename, 'URDF mesh filename');
      const relative = this.resolvePackageReference(reference, sourceRoot);
      const verified = verifiedFiles.get(relative);
      if (!verified) throw new Error(`URDF mesh is not declared in the verified source manifest: ${reference}`);
      const stagedAbsolute = path.resolve(stageRoot, ...relative.split('/'));
      this.assertWithin(stageRoot, stagedAbsolute);
      assets.set(reference, {
        originalReference: reference,
        stagedRelativePath: projectRelative(this.project.root, stagedAbsolute),
        sha256: verified.sha256,
        bytes: verified.bytes,
        contained: true,
      });
      const tip = path.basename(relative).toLowerCase().includes('tip');
      losses.push(loss('URDF-MESH-APPROXIMATION', entityPath, `${reference} is retained and hash-verified but represented by a ${tip ? 'finger-tip' : 'finger'} box primitive in RobotGraph v1.`));
      return { primitive: 'BOX', size: tip ? [0.09, 0.035, 0.025] : [0.12, 0.04, 0.03] };
    }
    throw new Error(`URDF geometry is unsupported at ${entityPath}`);
  }

  private resolvePackageReference(reference: string, sourceRoot: string): string {
    const prefix = 'package://urdf_tutorial/';
    if (!reference.startsWith(prefix)) throw new Error(`URDF asset reference requires an explicit supported package mapping: ${reference}`);
    const relative = normalizeRelative(reference.slice(prefix.length));
    const resolved = path.resolve(sourceRoot, ...relative.split('/'));
    this.assertWithin(sourceRoot, resolved);
    return relative;
  }

  private assertWithin(root: string, target: string): void {
    const normalizedRoot = path.resolve(root);
    const normalizedTarget = path.resolve(target);
    if (normalizedTarget !== normalizedRoot && !normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)) {
      throw new Error('Import path escaped its approved root');
    }
  }
}

function computeFrames(
  rootLinkId: string,
  links: Map<string, UnknownRecord>,
  joints: RobotJoint[],
): Map<string, Transform> {
  const frames = new Map<string, Transform>([[rootLinkId, identityTransform()]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const joint of joints) {
      if (!links.has(joint.parentLinkId) || !links.has(joint.childLinkId)) throw new Error(`URDF joint ${joint.id} references a missing link`);
      const parent = frames.get(joint.parentLinkId);
      if (!parent || frames.has(joint.childLinkId)) continue;
      frames.set(joint.childLinkId, compose(parent, {
        position: joint.origin.position,
        rotation: eulerMatrix(joint.origin.rotationEuler),
      }));
      changed = true;
    }
  }
  if (frames.size !== links.size) throw new Error('URDF kinematic graph is cyclic or disconnected');
  return frames;
}

function origin(value: unknown): Transform {
  const raw = recordOrEmpty(value);
  const position = vector(raw.xyz ?? '0 0 0', 3, 'URDF origin xyz') as Vector3;
  const rotation = vector(raw.rpy ?? '0 0 0', 3, 'URDF origin rpy') as Vector3;
  return { position, rotation: eulerMatrix(rotation) };
}

function identityTransform(): Transform {
  return { position: [0, 0, 0], rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1] };
}

function compose(parent: Transform, child: Transform): Transform {
  const rotated = multiplyVector(parent.rotation, child.position);
  return {
    position: [parent.position[0] + rotated[0], parent.position[1] + rotated[1], parent.position[2] + rotated[2]],
    rotation: multiplyMatrix(parent.rotation, child.rotation),
  };
}

function eulerMatrix([roll, pitch, yaw]: Vector3): Matrix3 {
  const [cr, sr, cp, sp, cy, sy] = [Math.cos(roll), Math.sin(roll), Math.cos(pitch), Math.sin(pitch), Math.cos(yaw), Math.sin(yaw)];
  return [
    cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr,
    sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr,
    -sp, cp * sr, cp * cr,
  ];
}

function matrixToEuler(matrix: Matrix3): Vector3 {
  const pitch = Math.asin(Math.max(-1, Math.min(1, -matrix[6])));
  const cp = Math.cos(pitch);
  if (Math.abs(cp) > 1e-7) return [Math.atan2(matrix[7], matrix[8]), pitch, Math.atan2(matrix[3], matrix[0])];
  return [Math.atan2(-matrix[5], matrix[4]), pitch, 0];
}

function multiplyMatrix(left: Matrix3, right: Matrix3): Matrix3 {
  const result = new Array<number>(9).fill(0);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = [0, 1, 2].reduce((sum, index) => sum + left[row * 3 + index]! * right[index * 3 + column]!, 0);
    }
  }
  return result as Matrix3;
}

function multiplyVector(matrix: Matrix3, value: Vector3): Vector3 {
  return [
    matrix[0] * value[0] + matrix[1] * value[1] + matrix[2] * value[2],
    matrix[3] * value[0] + matrix[4] * value[1] + matrix[5] * value[2],
    matrix[6] * value[0] + matrix[7] * value[1] + matrix[8] * value[2],
  ];
}

function minimumZ(transform: Transform, geometry: RobotGeometry): number {
  const half: Vector3 = geometry.primitive === 'BOX'
    ? [geometry.size[0] / 2, geometry.size[1] / 2, geometry.size[2] / 2]
    : geometry.primitive === 'SPHERE'
      ? [geometry.radius, geometry.radius, geometry.radius]
      : [geometry.radius, geometry.radius, geometry.depth / 2];
  const worldHalfZ = Math.abs(transform.rotation[6]) * half[0]
    + Math.abs(transform.rotation[7]) * half[1]
    + Math.abs(transform.rotation[8]) * half[2];
  return transform.position[2] - worldHalfZ;
}

function sameTransform(left: Transform, right: Transform): boolean {
  return [...left.position, ...left.rotation].every((value, index) => Math.abs(value - [...right.position, ...right.rotation][index]!) <= 1e-9);
}

function conversion(code: string, entityPath: string, message: string): ImportReport['conversions'][number] {
  return { code, entityPath, message };
}

function loss(code: string, entityPath: string, message: string): ImportReport['losses'][number] {
  return { code, severity: 'warning', entityPath, message };
}

function array(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as UnknownRecord;
}

function recordOrEmpty(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function number(value: unknown, label: string): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be finite`);
  return parsed;
}

function positive(value: unknown, label: string): number {
  const parsed = number(value, label);
  if (parsed <= 0) throw new Error(`${label} must be greater than zero`);
  return parsed;
}

function positiveInteger(value: unknown, label: string): number {
  const parsed = number(value, label);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function vector(value: unknown, length: number, label: string): number[] {
  const entries = typeof value === 'string'
    ? value.trim().split(/\s+/).map((entry) => number(entry, label))
    : Array.isArray(value) ? value.map((entry) => number(entry, label)) : [];
  if (entries.length !== length) throw new Error(`${label} must contain ${length} finite values`);
  return entries;
}

function sha256Value(value: unknown, label: string): string {
  const parsed = string(value, label).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(parsed)) throw new Error(`${label} is invalid`);
  return parsed;
}

function normalizeRelative(value: string): string {
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error('Import source path is not a contained relative path');
  }
  return normalized;
}

function projectRelative(root: string, target: string): string {
  return path.relative(root, target).split(path.sep).join('/');
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function escapePath(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

async function fileSha256(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}
