import { toSvg, toPng } from 'html-to-image';

export interface ExportBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ExportViewport {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

interface NodeLike {
  readonly position: { readonly x: number; readonly y: number };
  readonly measured?: { readonly width?: number; readonly height?: number };
  readonly width?: number;
  readonly height?: number;
}

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 40;
const DEFAULT_PADDING = 20;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const EXPORT_WIDTH = 1920;
const EXPORT_HEIGHT = 1080;

export function computeNodeBounds(nodes: ReadonlyArray<NodeLike>): ExportBounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;
    const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function computeExportViewport(
  bounds: ExportBounds,
  targetWidth: number,
  targetHeight: number,
  padding = DEFAULT_PADDING,
): ExportViewport {
  if (bounds.width === 0 || bounds.height === 0) {
    return { x: 0, y: 0, zoom: 1 };
  }

  const paddedWidth = bounds.width + padding * 2;
  const paddedHeight = bounds.height + padding * 2;

  const zoom = Math.min(
    targetWidth / paddedWidth,
    targetHeight / paddedHeight,
    MAX_ZOOM,
  );
  const clampedZoom = Math.max(MIN_ZOOM, zoom);

  const x = (targetWidth - paddedWidth * clampedZoom) / 2 - (bounds.x - padding) * clampedZoom;
  const y = (targetHeight - paddedHeight * clampedZoom) / 2 - (bounds.y - padding) * clampedZoom;

  return { x, y, zoom: clampedZoom };
}

const EXCLUDED_CLASSES = ['react-flow__minimap', 'react-flow__controls'];

function exportFilter(el: HTMLElement): boolean {
  if (!el.classList) return true;
  return !EXCLUDED_CLASSES.some(cls => el.classList.contains(cls));
}

export type ExportFormat = 'svg' | 'png';

export async function exportDiagram(
  canvasElement: HTMLElement,
  nodes: ReadonlyArray<NodeLike>,
  format: ExportFormat,
  filename?: string,
  pixelRatio = 2,
): Promise<void> {
  const viewport = canvasElement.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) {
    throw new Error('Cannot export: React Flow viewport not found');
  }

  const bounds = computeNodeBounds(nodes);
  const vp = computeExportViewport(bounds, EXPORT_WIDTH, EXPORT_HEIGHT);

  const exportFn = format === 'svg' ? toSvg : toPng;
  const ext = format === 'svg' ? '.svg' : '.png';
  const name = (filename ?? 'diagram') + ext;

  const opts: Record<string, unknown> = {
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
    style: {
      width: `${EXPORT_WIDTH}px`,
      height: `${EXPORT_HEIGHT}px`,
      transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
    },
    filter: exportFilter,
  };
  if (format === 'png') {
    opts.pixelRatio = pixelRatio;
  }

  const dataUrl = await exportFn(viewport, opts);

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = name;
  link.href = blobUrl;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
