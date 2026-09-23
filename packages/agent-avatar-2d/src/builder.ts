import type { AvatarCollection, AvatarSize, FamilyPalette, PartAssignment } from './types.js';
import { DetailLevel, DETAIL_TIERS } from './types.js';
import { HEAD_FACE_OFFSET } from './config-table.js';

const FACE_PARTS = new Set(['eyes', 'nose', 'mouth', 'brow', 'expression', 'glasses', 'beard', 'hat']);

const LAYER_ORDER: readonly string[] = [
  'costume', 'head', 'eyes', 'nose', 'mouth', 'hair', 'hat', 'beard', 'expression', 'brow', 'glasses', 'prop', 'acc',
];

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

export function buildAvatar(
  config: PartAssignment,
  palette: FamilyPalette,
  size: AvatarSize,
  collection: AvatarCollection,
): string {
  const detail = DETAIL_TIERS[size];
  const layers = collectLayers(config, detail, collection);
  const sorted = sortByLayerOrder(layers);
  const faceOffset = HEAD_FACE_OFFSET[config.head] ?? 0;
  const inner = sorted.map(l => {
    const shift = FACE_PARTS.has(l.category) && faceOffset > 0;
    const attrs = shift
      ? ` data-part="${l.category}:${l.partId}" transform="translate(0,${faceOffset})"`
      : ` data-part="${l.category}:${l.partId}"`;
    return `  <g${attrs}>${l.content}</g>`;
  }).join('\n');
  const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" role="img">\n${inner}\n</svg>`;
  return applyPalette(raw, palette);
}
