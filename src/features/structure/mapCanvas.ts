/**
 * Interação do mapa: arrastar cartões, mover o fundo (pan), zoom por botões,
 * Ctrl+roda e pinça, e redesenho das conexões. Posições e vista ficam salvas no projeto.
 */
import { persistProjects, persistProjectsSoon } from '../../services/db';
import type { Point } from '../../types/branch';
import type { MapView, Project } from '../../types/project';
import { $, $$, $maybe } from '../../utils/dom';

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const DRAG_THRESHOLD = 4;
const GRID = 18;
const LINE_ANCHOR_Y = 24;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Gesture =
  | { type: 'pinch'; distance: number; midX: number; midY: number; moved: true; el?: undefined }
  | { type: 'node'; target: Point; el: HTMLElement; startX: number; startY: number; originX: number; originY: number; moved: boolean }
  | { type: 'pan'; startX: number; startY: number; originX: number; originY: number; moved: boolean; el?: undefined };

export function mountMap(p: Project, container: HTMLElement, onNodeClick: (branchId: string) => void): void {
  const map = $maybe('#branchMap', container);
  if (!map) return;
  const world = $('#mapWorld', map);
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: Gesture | null = null;
  let suppressClick = false;
  // A Estrutura é só visualização: os cartões não se movem, o gesto vira pan.
  const canMoveNodes = false;

  /** Mantém o gesto mesmo se o dedo/mouse sair do mapa; alguns navegadores recusam e seguimos sem captura. */
  const capture = (pointerId: number): void => {
    try {
      map.setPointerCapture(pointerId);
    } catch {
      /* ponteiro já liberado */
    }
  };

  const nodeEl = (id: string | null): HTMLElement | null => (id ? world.querySelector<HTMLElement>(`[data-node="${id}"]`) : null);

  function bounds(): Bounds {
    return $$('.map-node', world).reduce<Bounds>(
      (r, e) => ({
        x0: Math.min(r.x0, e.offsetLeft),
        y0: Math.min(r.y0, e.offsetTop),
        x1: Math.max(r.x1, e.offsetLeft + e.offsetWidth),
        y1: Math.max(r.y1, e.offsetTop + e.offsetHeight),
      }),
      { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
    );
  }

  function drawLines(): void {
    for (const b of p.branches) {
      const path = world.querySelector(`[data-line="${b.id}"]`);
      const from = nodeEl(b.parent) ?? nodeEl('root');
      const to = nodeEl(b.id);
      if (!path || !from || !to) continue;
      const toRight = to.offsetLeft + to.offsetWidth / 2 >= from.offsetLeft + from.offsetWidth / 2;
      const x1 = toRight ? from.offsetLeft + from.offsetWidth : from.offsetLeft;
      const x2 = toRight ? to.offsetLeft : to.offsetLeft + to.offsetWidth;
      const y1 = from.offsetTop + LINE_ANCHOR_Y;
      const y2 = to.offsetTop + LINE_ANCHOR_Y;
      const c = Math.max(40, Math.abs(x2 - x1) / 2) * (toRight ? 1 : -1);
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`);
    }
  }

  const view = (): MapView => (p.view ??= { x: 0, y: 0, z: 1 });

  function apply(): void {
    const v = view();
    world.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.z})`;
    map!.style.backgroundSize = `${GRID * v.z}px ${GRID * v.z}px`;
    map!.style.backgroundPosition = `${v.x}px ${v.y}px`;
    const label = $maybe('#zoomReset', container);
    if (label) label.textContent = `${Math.round(v.z * 100)}%`;
  }

  /** Enquadra todos os cartões; em telas pequenas mantém o texto legível (zoom mínimo 80%). */
  function fit(): void {
    const b = bounds();
    const w = b.x1 - b.x0;
    const h = b.y1 - b.y0;
    const W = map!.clientWidth;
    const H = map!.clientHeight;
    const z = clamp(Math.min((W - 80) / w, (H - 80) / h), W < 600 ? 0.8 : 0.5, 1);
    p.view = {
      z,
      x: w * z < W ? (W - w * z) / 2 - b.x0 * z : 40 - b.x0 * z,
      y: h * z < H ? (H - h * z) / 2 - b.y0 * z : 40 - b.y0 * z,
    };
    apply();
  }

  function zoomAt(factor: number, cx: number, cy: number): void {
    const v = view();
    const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
    const k = z / v.z;
    v.x = cx - (cx - v.x) * k;
    v.y = cy - (cy - v.y) * k;
    v.z = z;
    apply();
  }

  const center = (): [number, number] => [map.clientWidth / 2, map.clientHeight / 2];

  if (!p.view) fit();
  drawLines();
  apply();

  // Barra de controles
  $$('[data-map]', container).forEach((btn) =>
    btn.addEventListener('click', () => {
      switch (btn.dataset.map) {
        case 'zoom-in':
          zoomAt(1.2, ...center());
          break;
        case 'zoom-out':
          zoomAt(1 / 1.2, ...center());
          break;
        case 'zoom-reset':
          zoomAt(1 / view().z, ...center());
          break;
        case 'fit':
          fit();
          break;
        case 'reset': {
          const b = bounds();
          p.view = { z: 1, x: 40 - b.x0, y: 40 - b.y0 };
          apply();
          break;
        }
      }
      persistProjectsSoon();
    }),
  );

  map.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = map.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      else {
        view().x -= e.deltaX;
        view().y -= e.deltaY;
        apply();
      }
      persistProjectsSoon();
    },
    { passive: false },
  );

  map.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest('button')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture = { type: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, moved: true };
      capture(e.pointerId);
      return;
    }
    const el = target.closest<HTMLElement>('[data-node]');
    const id = el?.dataset.node;
    const point = id === 'root' ? p.root : p.branches.find((b) => b.id === id);
    // Arrastar cartões exige Mapa → Editar; sem isso o gesto vira pan.
    gesture =
      el && point && canMoveNodes
        ? { type: 'node', target: point, el, startX: e.clientX, startY: e.clientY, originX: point.x, originY: point.y, moved: false }
        : { type: 'pan', startX: e.clientX, startY: e.clientY, originX: view().x, originY: view().y, moved: false };
  });

  map.addEventListener('pointermove', (e) => {
    if (!gesture || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = view();
    const r = map.getBoundingClientRect();
    if (gesture.type === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      zoomAt(distance / gesture.distance, midX - r.left, midY - r.top);
      v.x += midX - gesture.midX;
      v.y += midY - gesture.midY;
      apply();
      Object.assign(gesture, { distance, midX, midY });
      return;
    }
    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    if (!gesture.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      gesture.moved = true;
      capture(e.pointerId);
      if (gesture.type === 'node') gesture.el.classList.add('dragging');
      else map.classList.add('panning');
    }
    if (gesture.type === 'node') {
      gesture.target.x = Math.round(gesture.originX + dx / v.z);
      gesture.target.y = Math.round(gesture.originY + dy / v.z);
      gesture.el.style.left = `${gesture.target.x}px`;
      gesture.el.style.top = `${gesture.target.y}px`;
      drawLines();
    } else {
      v.x = gesture.originX + dx;
      v.y = gesture.originY + dy;
      apply();
    }
  });

  const release = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    const done = gesture;
    if (done.type === 'pinch' && pointers.size > 0) return;
    gesture = null;
    map.classList.remove('panning');
    done.el?.classList.remove('dragging');
    if (!done.moved) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (done.type === 'node') persistProjects();
    else persistProjectsSoon();
  };
  map.addEventListener('pointerup', release);
  map.addEventListener('pointercancel', release);

  map.addEventListener('click', (e) => {
    if (suppressClick) return;
    const target = e.target as Element;
    const id = target.closest<HTMLElement>('[data-node]')?.dataset.node;
    if (!id || id === 'root' || target.closest('button')) return;
    onNodeClick(id);
  });
}
