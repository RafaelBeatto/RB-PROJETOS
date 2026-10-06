export function progressBar(percent: number, small = false): string {
  return `<div class="pbar${small ? ' sm' : ''}"><i style="width:${percent}%"></i></div>`;
}

/** Barra com o número ao lado ("72%"). */
export function progressRow(percent: number): string {
  return `<div class="progress">${progressBar(percent)}<span>${percent}%</span></div>`;
}
