/** Every drawn thing in the app. No library: a handful of small SVGs. */
import { bandX, el, shape, svg, trace } from './dom';
import type { Choice, Round } from '../engine';

const W = 300;

/** A left/right mark, so box identity never rests on colour or a font glyph. */
export function boxMark(side: Choice): SVGSVGElement {
  return svg(
    { viewBox: '0 0 20 20', class: 'mark', 'aria-hidden': 'true' },
    shape('rect', { x: 2, y: 3.5, width: 16, height: 13 }),
    shape('rect', { class: 'half', x: side === 0 ? 3 : 11, y: 4.5, width: 6, height: 11 }),
  );
}

/** A spoken summary, since a row of coloured cells says nothing aloud. */
export function stripLabel(rounds: readonly Round[]): string {
  const wins = rounds.filter((r) => r.win).length;
  return `Last ${rounds.length} taps: ${wins} found the reward, ${rounds.length - wins} missed.`;
}

export interface StripOptions {
  /** Stretch cells to fill the width, so the row lines up with a trace above it. */
  aligned?: boolean;
  /** 1-based tap to mark as the current one. */
  at?: number;
}

/** The cells alone, for a strip that is refilled in place. */
export function stripCells(rounds: readonly Round[], opts: StripOptions = {}): HTMLElement[] {
  return rounds.map((r, i) =>
    el(
      'b',
      { class: `${r.win ? 'w' : 'l'}${opts.at === i + 1 ? ' now' : ''}`, 'aria-hidden': 'true' },
      r.choice === 0 ? 'L' : 'R',
    ),
  );
}

export function choiceStrip(rounds: readonly Round[], opts: StripOptions = {}): HTMLElement {
  return el(
    'div',
    { class: `strip${opts.aligned ? ' aligned' : ''}`, role: 'img', 'aria-label': stripLabel(rounds) },
    ...stripCells(rounds, opts),
  );
}

export function scoreCurve(running: readonly number[]): SVGSVGElement {
  const h = 70;
  const span = Math.max(4, ...running.map((v) => Math.abs(v)));
  const norm = running.map((v) => 0.5 + v / (span * 2));
  const zero = 3 + 0.5 * (h - 6);
  const last = running[running.length - 1] ?? 0;
  return svg(
    { viewBox: `0 0 ${W} ${h}`, class: 'figure', role: 'img', 'aria-label': `Running score, now ${last}` },
    shape('line', { x1: 0, y1: zero, x2: W, y2: zero, stroke: 'var(--rule)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    shape('polyline', {
      points: trace(norm, W, h, true),
      fill: 'none',
      stroke: last < 0 ? 'var(--miss)' : last > 0 ? 'var(--win)' : 'var(--muted)',
      'stroke-width': 2.2,
      'stroke-linejoin': 'round',
    }),
  );
}

/**
 * What the opponent believed, tap by tap.
 *
 * Drawn on band positions so it sits directly above the strip of the same
 * taps, and carries a playhead so the two can be read as one figure.
 */
export function beliefTrace(beliefs: readonly number[], at?: number): SVGSVGElement {
  const h = 88;
  const kids: SVGElement[] = [
    shape('line', { x1: 0, y1: h / 2, x2: W, y2: h / 2, stroke: 'var(--rule)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
  ];
  if (at !== undefined && beliefs.length) {
    const x = bandX(at - 1, beliefs.length, W);
    kids.push(shape('line', { x1: x, y1: 0, x2: x, y2: h, stroke: 'var(--accent)', 'stroke-width': 1, opacity: 0.45 }));
  }
  kids.push(
    shape('polyline', {
      points: trace(beliefs, W, h, true),
      fill: 'none',
      stroke: 'var(--accent)',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    }),
  );
  if (beliefs.length) {
    const i = beliefs.length - 1;
    kids.push(
      shape('circle', {
        cx: bandX(i, beliefs.length, W),
        cy: 3 + (1 - beliefs[i]) * (h - 6),
        r: 3.4,
        fill: 'var(--accent)',
      }),
    );
  }
  return svg(
    { viewBox: `0 0 ${W} ${h}`, class: 'figure', preserveAspectRatio: 'none', role: 'img', 'aria-label': 'What it believed, tap by tap' },
    ...kids,
  );
}

/** The player's switch rate against a fair coin's 50%. */
export function switchGauge(rate: number): SVGSVGElement {
  const h = 26;
  return svg(
    {
      viewBox: `0 0 ${W} ${h}`,
      class: 'figure',
      role: 'img',
      'aria-label': `You switched ${Math.round(rate * 100)}% of the time. A fair coin switches 50%.`,
    },
    shape('rect', { x: 0, y: 6, width: W, height: 14, fill: 'var(--sunk)', stroke: 'var(--rule)' }),
    shape('rect', { x: 0, y: 6, width: Math.max(1, rate * W), height: 14, fill: 'var(--accent)' }),
    shape('line', { x1: W / 2, y1: 0, x2: W / 2, y2: h, stroke: 'var(--miss)', 'stroke-width': 1.6 }),
  );
}
