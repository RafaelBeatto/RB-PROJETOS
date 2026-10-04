/**
 * Ícones Lucide convertidos em SVG inline. Só os ícones importados aqui entram no build.
 */
import {
  Activity,
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Diamond,
  Ellipsis,
  EllipsisVertical,
  GitBranch,
  Info,
  LayoutGrid,
  Link,
  Lock,
  LockOpen,
  LogOut,
  Map,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Scan,
  Search,
  Settings,
  Square,
  SquareCheckBig,
  SquareKanban,
  Sun,
  Trash,
  TriangleAlert,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide';

type IconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

const ICONS = {
  activity: Activity,
  archive: Archive,
  arrowRight: ArrowRight,
  board: SquareKanban,
  branch: GitBranch,
  cards: LayoutGrid,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  close: X,
  comment: MessageSquare,
  done: CircleCheck,
  edit: Pencil,
  info: Info,
  link: Link,
  lock: Lock,
  unlock: LockOpen,
  logout: LogOut,
  map: Map,
  milestone: Diamond,
  more: Ellipsis,
  moreVertical: EllipsisVertical,
  paperclip: Paperclip,
  plus: Plus,
  projects: LayoutGrid,
  reset: RotateCcw,
  scan: Scan,
  search: Search,
  selectOff: Square,
  selectOn: SquareCheckBig,
  settings: Settings,
  today: Sun,
  trash: Trash,
  users: Users,
  warning: TriangleAlert,
  zoomIn: ZoomIn,
  zoomOut: ZoomOut,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

function attrs(a: Record<string, string | number | undefined>): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(' ');
}

const cache: Partial<Record<IconName, string>> = {};

/** SVG do ícone, com tamanho herdado da fonte (1em) e cor do texto. */
export function icon(name: IconName, className = ''): string {
  const body = (cache[name] ??= (ICONS[name] as IconNode).map(([tag, a]) => `<${tag} ${attrs(a)}/>`).join(''));
  return `<svg class="ic${className ? ` ${className}` : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
