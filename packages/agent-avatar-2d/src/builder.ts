import type { AvatarCollection, AvatarSize, FamilyPalette, HeadFaceSpec, PartAssignment } from './types.js';
import { DetailLevel, DETAIL_TIERS } from './types.js';
import { HEAD_FACE_SPECS, CANONICAL_FACE } from './config-table.js';

interface TempleRect { x: number; y: number; w: number; h: number; }
interface TempleFill { left: TempleRect; right: TempleRect; }

const TEMPLE_FILLS: Record<string, TempleFill> = {
  'soft-oval':  { left: { x: 68, y: 32, w: 14, h: 12 }, right: { x: 118, y: 32, w: 14, h: 12 } },
  'weathered':  { left: { x: 64, y: 34, w: 14, h: 14 }, right: { x: 122, y: 34, w: 14, h: 14 } },
  'square-jaw': { left: { x: 62, y: 34, w: 16, h: 14 }, right: { x: 122, y: 34, w: 16, h: 14 } },
  'standard':   { left: { x: 64, y: 34, w: 14, h: 14 }, right: { x: 122, y: 34, w: 14, h: 14 } },
  'strong-sym': { left: { x: 64, y: 34, w: 14, h: 14 }, right: { x: 122, y: 34, w: 14, h: 14 } },
  'diamond':    { left: { x: 66, y: 36, w: 14, h: 14 }, right: { x: 120, y: 36, w: 14, h: 14 } },
  'fallback':   { left: { x: 64, y: 34, w: 14, h: 14 }, right: { x: 122, y: 34, w: 14, h: 14 } },
  'angular':    { left: { x: 62, y: 34, w: 16, h: 14 }, right: { x: 122, y: 34, w: 16, h: 14 } },
  'round':      { left: { x: 62, y: 36, w: 18, h: 16 }, right: { x: 120, y: 36, w: 18, h: 16 } },
  'heart':      { left: { x: 64, y: 36, w: 16, h: 14 }, right: { x: 120, y: 36, w: 16, h: 14 } },
  'round-wide': { left: { x: 56, y: 42, w: 20, h: 16 }, right: { x: 124, y: 42, w: 20, h: 16 } },
};

const LAYER_ORDER: readonly string[] = [
  'costume', 'head', 'eyes', 'nose', 'mouth', 'hair', 'hat', 'beard', 'expression', 'brow', 'glasses', 'prop', 'acc',
];

type PosGroup = 'eye-split' | 'nose' | 'mouth' | 'hat' | 'none';

function posGroup(category: string): PosGroup {
  switch (category) {
    case 'eyes': case 'brow': case 'glasses': case 'expression':
      return 'eye-split';
    case 'nose':
      return 'nose';
    case 'mouth': case 'beard':
      return 'mouth';
    case 'hat':
      return 'hat';
    default:
      return 'none';
  }
}

function splitAtRightEye(content: string): [string, string] {
  const idx = content.indexOf('<!-- Right eye');
  if (idx !== -1) return [content.substring(0, idx), content.substring(idx)];
  return splitByCenter(content);
}

function splitByCenter(content: string): [string, string] {
  const lines = content.split('\n');
  const left: string[] = [];
  const right: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('<!--')) continue;
    const xMatch = trimmed.match(/\bx="(\d+(?:\.\d+)?)"/);
    const widthMatch = trimmed.match(/\bwidth="(\d+(?:\.\d+)?)"/);
    if (xMatch && widthMatch) {
      const centerX = parseFloat(xMatch[1]!) + parseFloat(widthMatch[1]!) / 2;
      (centerX < 100 ? left : right).push(line);
    } else {
      left.push(line);
    }
  }
  return [left.join('\n'), right.join('\n')];
}

function wrapTranslate(content: string, dx: number, dy: number): string {
  if (dx === 0 && dy === 0) return content;
  return `<g transform="translate(${dx},${dy})">${content}</g>`;
}

interface Layer {
  readonly category: string;
  readonly partId: string;
  readonly content: string;
}

function collectLayers(config: PartAssignment, detail: DetailLevel, collection: AvatarCollection): Layer[] {
  const layers: Layer[] = [];

  function add(category: string, partId: string | null): void {
    if (partId === null) return;
    const key = `${category}:${partId}`;
    const content = collection.parts.get(key);
    if (content) layers.push({ category, partId, content });
  }

  add('costume', config.costume);
  add('head', config.head);
  add('eyes', config.eyes);
  add('nose', config.nose);
  add('mouth', config.mouth);
  add('hair', config.hair);

  if (detail >= DetailLevel.MD) {
    add('hat', config.hat);
  }

  add('beard', config.facialHair === 'none' ? null : config.facialHair);

  if (detail >= DetailLevel.SM) {
    add('expression', config.expression);
  }

  add('brow', config.eyebrows);

  if (detail >= DetailLevel.SM) {
    add('glasses', config.glasses);
  }

  if (detail >= DetailLevel.MD) {
    for (const p of config.props) {
      add('prop', p);
    }
  }

  if (detail >= DetailLevel.LG) {
    for (const a of config.accessories) {
      add('acc', a);
    }
  }

  return layers;
}

function applyPalette(svg: string, palette: FamilyPalette): string {
  return svg
    .replaceAll('var(--skin)', palette.skin)
    .replaceAll('var(--primary)', palette.primary)
    .replaceAll('var(--secondary)', palette.secondary)
    .replaceAll('var(--accent)', palette.accent)
    .replaceAll('var(--hair-color)', palette.hairColor)
    .replaceAll('var(--iris)', palette.iris)
    .replaceAll('var(--iris-dark)', palette.irisDark);
}

function sortByLayerOrder(layers: Layer[]): Layer[] {
  return [...layers].sort((a, b) => {
    const ai = LAYER_ORDER.indexOf(a.category);
    const bi = LAYER_ORDER.indexOf(b.category);
    return ai - bi;
  });
}

function renderLayer(l: Layer, spec: HeadFaceSpec): string {
  const tag = `data-part="${l.category}:${l.partId}"`;
  const group = posGroup(l.category);

  if (group === 'eye-split') {
    const eyeYDelta = spec.eyeY - CANONICAL_FACE.eyeY;
    const leftXDelta = spec.eyeLeftX - CANONICAL_FACE.eyeLeftX;
    const rightXDelta = spec.eyeRightX - CANONICAL_FACE.eyeRightX;

    if (leftXDelta === 0 && rightXDelta === 0 && eyeYDelta === 0) {
      return `  <g ${tag}>${l.content}</g>`;
    }

    const [leftContent, rightContent] = l.category === 'eyes'
      ? splitAtRightEye(l.content)
      : splitByCenter(l.content);

    const hasLeft = leftContent.trim().length > 0;
    const hasRight = rightContent.trim().length > 0;

    if (!hasLeft && !hasRight) return `  <g ${tag}>${l.content}</g>`;

    const parts: string[] = [];
    if (hasLeft) parts.push(wrapTranslate(leftContent, leftXDelta, eyeYDelta));
    if (hasRight) parts.push(wrapTranslate(rightContent, rightXDelta, eyeYDelta));
    return `  <g ${tag}>${parts.join('')}</g>`;
  }

  if (group === 'nose') {
    const dy = spec.noseY - CANONICAL_FACE.noseY;
    const inner = dy !== 0 ? wrapTranslate(l.content, 0, dy) : l.content;
    return `  <g ${tag}>${inner}</g>`;
  }

  if (group === 'mouth') {
    const dy = spec.mouthY - CANONICAL_FACE.mouthY;
    const inner = dy !== 0 ? wrapTranslate(l.content, 0, dy) : l.content;
    return `  <g ${tag}>${inner}</g>`;
  }

  if (group === 'hat') {
    const inner = spec.yOffset !== 0 ? wrapTranslate(l.content, 0, spec.yOffset) : l.content;
    return `  <g ${tag}>${inner}</g>`;
  }

  return `  <g ${tag}>${l.content}</g>`;
}

export function buildAvatar(
  config: PartAssignment,
  palette: FamilyPalette,
  size: AvatarSize,
  collection: AvatarCollection,
): string {
  const detail = DETAIL_TIERS[size];
  const layers = collectLayers(config, detail, collection);
  const sorted = sortByLayerOrder(layers);
  const spec = HEAD_FACE_SPECS[config.head] ?? CANONICAL_FACE;
  const rendered = sorted.map(l => renderLayer(l, spec));
  const temple = TEMPLE_FILLS[config.head];
  if (temple) {
    const headIdx = sorted.findIndex(l => l.category === 'head');
    if (headIdx >= 0) {
      const tl = temple.left;
      const tr = temple.right;
      const fill = `  <g data-part="temple-fill"><rect x="${tl.x}" y="${tl.y}" width="${tl.w}" height="${tl.h}" fill="var(--hair-color)"/><rect x="${tr.x}" y="${tr.y}" width="${tr.w}" height="${tr.h}" fill="var(--hair-color)"/></g>`;
      rendered.splice(headIdx + 1, 0, fill);
    }
  }
  const inner = rendered.join('\n');
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img">\n${inner}\n</svg>`;
  return applyPalette(raw, palette);
}
