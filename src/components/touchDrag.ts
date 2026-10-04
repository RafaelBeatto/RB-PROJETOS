/**
 * Arrastar cartões entre colunas pelo toque: segurar ~0,3 s, arrastar e soltar.
 * No mouse, os quadros usam o arrastar nativo do navegador (draggable).
 */
const HOLD_MS = 300;
const MOVE_TOLERANCE = 8;
const EDGE = 40;
const EDGE_SCROLL = 14;

interface DragState {
  ghost: HTMLElement;
  offsetX: number;
  offsetY: number;
  column: HTMLElement | null;
}

export function enableTouchDrag(card: HTMLElement, onDrop: (column: HTMLElement) => void): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let drag: DragState | null = null;
  let startX = 0;
  let startY = 0;
  const board = card.closest<HTMLElement>('.board');
  const columns = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>('.column'));

  const finish = (): void => {
    clearTimeout(timer);
    if (!drag) return;
    drag.ghost.remove();
    card.classList.remove('dragging');
    columns().forEach((c) => c.classList.remove('drop-on'));
    drag = null;
  };

  card.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      timer = setTimeout(() => {
        const r = card.getBoundingClientRect();
        const ghost = card.cloneNode(true) as HTMLElement;
        ghost.classList.add('drag-ghost');
        Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
        document.body.appendChild(ghost);
        drag = { ghost, offsetX: startX - r.left, offsetY: startY - r.top, column: null };
        card.classList.add('dragging');
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
      if (board) {
        if (t.clientX > innerWidth - EDGE) board.scrollLeft += EDGE_SCROLL;
        else if (t.clientX < EDGE) board.scrollLeft -= EDGE_SCROLL;
      }
      const column = document.elementFromPoint(t.clientX, t.clientY)?.closest<HTMLElement>('.column') ?? null;
      drag.column = column;
      columns().forEach((c) => c.classList.toggle('drop-on', c === column));
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
