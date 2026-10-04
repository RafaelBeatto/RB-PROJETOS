/**
 * Arrastar cartões entre colunas pelo toque: segurar ~0,3 s, arrastar e soltar.
 * No mouse, os quadros usam o arrastar nativo do navegador (draggable).
 */
const HOLD_MS = 300;
const MOVE_TOLERANCE = 8;
const EDGE = 56;
const EDGE_SCROLL = 12;

interface DragState {
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  column: HTMLElement | null;
  frame: number;
}

/** Coluna mais próxima do dedo; só a posição horizontal conta, para soltar acima, abaixo ou entre colunas. */
function columnAt(columns: HTMLElement[], x: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  for (const c of columns) {
    const r = c.getBoundingClientRect();
    const dist = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

export function enableTouchDrag(card: HTMLElement, onDrop: (column: HTMLElement) => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let drag: DragState | null = null;
  let startX = 0;
  let startY = 0;
  const board = card.closest<HTMLElement>('.board');
  const columns = (): HTMLElement[] => Array.from((board ?? document).querySelectorAll<HTMLElement>('.column'));

  let touching = false;

  const highlight = (): void => {
    if (!drag) return;
    drag.column = columnAt(columns(), drag.x);
    columns().forEach((c) => c.classList.toggle('drop-on', c === drag?.column));
  };

  // Rola o quadro enquanto o dedo estiver parado perto da borda (não só quando ele se mexe).
  const autoScroll = (): void => {
    if (!drag) return;
    if (board) {
      const r = board.getBoundingClientRect();
      const right = Math.min(r.right, innerWidth);
      const left = Math.max(r.left, 0);
      if (drag.x > right - EDGE) board.scrollLeft += EDGE_SCROLL;
      else if (drag.x < left + EDGE) board.scrollLeft -= EDGE_SCROLL;
      highlight();
    }
    drag.frame = requestAnimationFrame(autoScroll);
  };

  const finish = (): void => {
    clearTimeout(timer);
    touching = false;
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    drag.ghost.remove();
    card.classList.remove('dragging');
    board?.classList.remove('touch-dragging');
    columns().forEach((c) => c.classList.remove('drop-on'));
    drag = null;
  };

  // O toque longo não deve abrir o arrastar nativo (draggable) nem o menu do navegador.
  card.addEventListener('dragstart', (e) => {
    if (touching) e.preventDefault();
  });
  card.addEventListener('contextmenu', (e) => {
    if (touching) e.preventDefault();
  });

  card.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      touching = true;
      startX = t.clientX;
      startY = t.clientY;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const r = card.getBoundingClientRect();
        const ghost = card.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
        document.body.appendChild(ghost);
        drag = { ghost, offsetX: startX - r.left, offsetY: startY - r.top, x: startX, y: startY, column: null, frame: 0 };
        card.classList.add('dragging');
        // Sem isso o scroll-snap do celular desfaz a rolagem e o cartão não chega às outras colunas.
        board?.classList.add('touch-dragging');
        highlight();
        drag.frame = requestAnimationFrame(autoScroll);
        navigator.vibrate?.(15);
      }, HOLD_MS);
    },
    { passive: true },
  );

  card.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      if (!drag) {
        if (Math.hypot(t.clientX - startX, t.clientY - startY) > MOVE_TOLERANCE) clearTimeout(timer);
        return;
      }
      e.preventDefault();
      drag.ghost.style.left = `${t.clientX - drag.offsetX}px`;
      drag.ghost.style.top = `${t.clientY - drag.offsetY}px`;
      drag.x = t.clientX;
      drag.y = t.clientY;
      highlight();
    },
    { passive: false },
  );

  card.addEventListener('touchend', (e) => {
    if (!drag) return finish();
    e.preventDefault();
    const column = drag.column;
    finish();
    if (column) onDrop(column);
  });

  card.addEventListener('touchcancel', finish);
}

/** Arrastar com mouse (HTML5). `onDrop` recebe o id do cartão arrastado e a coluna. */
export function enableMouseDrop(column: HTMLElement, cardSelector: string, onDrop: (cardId: string, column: HTMLElement) => void): void {
  column.addEventListener('dragover', (e) => e.preventDefault());
  column.addEventListener('drop', (e) => {
    e.preventDefault();
    const card = document.querySelector<HTMLElement>(`${cardSelector}.dragging`);
    const id = card?.dataset.id;
    if (id) onDrop(id, column);
  });
}

export function enableMouseDrag(card: HTMLElement): void {
  card.addEventListener('dragstart', () => card.classList.add('dragging'));
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
}
