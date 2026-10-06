import { $ } from '../utils/dom';

let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string): void {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.hidden = true;
  }, Math.max(2200, message.length * 45));
}
