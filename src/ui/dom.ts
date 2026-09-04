/** Tiny DOM helpers. The whole app is a few hundred nodes; this is all it needs. */

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Kid = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v as EventListener);
    else if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else node.setAttribute(k, String(v));
  }
  append(node, kids);
  return node;
}

export function append(node: Element, kids: Kid[]): void {
  for (const kid of kids) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  }
}

const NS = 'http://www.w3.org/2000/svg';

export function svg(attrs: Record<string, string | number>, ...kids: SVGElement[]): SVGSVGElement {
  const node = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  node.append(...kids);
  return node;
}

export function shape(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Map values in [0,1] onto polyline points.
 *
 * `band` places each point over the centre of its own column rather than
 * spreading the first and last to the edges -- which is what lets a trace sit
 * exactly above a row of cells representing the same taps.
 */
export function trace(values: readonly number[], w: number, h: number, band = false, pad = 3): string {
  if (values.length < 2) return '';
  const n = values.length;
  return values
    .map((v, i) => {
      const x = band ? ((i + 0.5) / n) * w : (i / (n - 1)) * w;
      const y = pad + (1 - v) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Centre of column `i` of `n`, for lining a marker up with a cell. */
export function bandX(i: number, n: number, w: number): number {
  return ((i + 0.5) / n) * w;
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Move the reader to a new beat without scrolling the page under them. */
export function focus(node: HTMLElement): void {
  node.focus({ preventScroll: true });
}
