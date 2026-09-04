/**
 * The reusable parts of a screen.
 *
 * Each returns its node together with the handful of setters that keep it
 * live, so a screen closes over exactly the controls it owns. An earlier
 * version kept one shared bag of element references on the app object, which
 * produced two bugs: refs wiped before use, and refs left pointing at a
 * screen that had already been replaced.
 */
import { el, focus } from './dom';
import { boxMark, stripCells, stripLabel } from './figures';
import type { Belief, Choice, Round, Stats } from '../engine';

export interface Chip {
  node: HTMLElement;
  set(stats: Stats, visible?: boolean): void;
}

export function chip(): Chip {
  const node = el('span', { class: 'chip' });
  return {
    node,
    set(stats, visible = true) {
      node.hidden = !visible;
      node.textContent = `${stats.score >= 0 ? '+' : '−'}${Math.abs(stats.score)} · ${stats.taps} ${stats.taps === 1 ? 'tap' : 'taps'}`;
      node.classList.toggle('up', stats.score > 0);
      node.classList.toggle('down', stats.score < 0);
    },
  };
}

export interface BeliefBar {
  node: HTMLElement;
  set(belief: Belief, moved?: boolean): void;
}

export function beliefBar(caption: string): BeliefBar {
  const fill = el('i');
  const left = el('span', { class: 'l' });
  const right = el('span', { class: 'r' });
  // The two readouts are decoration for anyone hearing the page; the bar
  // itself carries a sentence with the number in it.
  left.setAttribute('aria-hidden', 'true');
  right.setAttribute('aria-hidden', 'true');
  const bar = el('div', { class: 'bar', role: 'img' }, fill, left, right);
  return {
    node: el('div', { class: 'group' }, el('span', { class: 'label', text: caption }), bar),
    set(belief, moved = false) {
      const pct = belief[0] * 100;
      const side = pct >= 50 ? 'left' : 'right';
      fill.style.width = `${pct.toFixed(1)}%`;
      left.textContent = `LEFT ${Math.round(pct)}%`;
      right.textContent = `${Math.round(100 - pct)}% RIGHT`;
      bar.setAttribute('aria-label', `${caption} ${side}, ${Math.round(Math.max(pct, 100 - pct))} percent`);
      if (!moved) return;
      // Restart the pulse: under reduced motion it is the only thing left
      // saying that this tap is what moved the bar.
      bar.classList.remove('moved');
      void bar.offsetWidth;
      bar.classList.add('moved');
    },
  };
}

export interface Boxes {
  node: HTMLElement;
  show(round: Round): void;
  clear(): void;
}

export function boxes(onTap: (choice: Choice) => void): Boxes {
  const make = (side: Choice, name: string) =>
    el(
      'button',
      { class: 'box', type: 'button', onclick: () => onTap(side), 'aria-label': `${name} box` },
      boxMark(side),
      name,
      el('span', { class: 'state' }),
    );
  const all = [make(0, 'Left'), make(1, 'Right')];
  const state = (b: HTMLElement) => b.querySelector('.state')!;
  return {
    node: el('div', { class: 'boxes' }, ...all),
    show(round) {
      all.forEach((b, i) => {
        b.classList.toggle('reward', i === round.reward);
        b.classList.toggle('empty', i !== round.reward);
        b.classList.toggle('taken', i === round.choice);
        state(b).textContent = i === round.reward ? 'REWARD' : 'EMPTY';
      });
    },
    clear() {
      all.forEach((b) => {
        b.classList.remove('reward', 'empty', 'taken');
        state(b).textContent = '';
      });
    },
  };
}

export interface Strip {
  node: HTMLElement;
  set(rounds: readonly Round[]): void;
}

export function strip(limit = 24): Strip {
  const node = el('div', { class: 'strip', role: 'img' });
  return {
    node,
    set(rounds) {
      const recent = rounds.slice(-limit);
      node.replaceChildren(...stripCells(recent));
      node.setAttribute('aria-label', stripLabel(recent));
    },
  };
}

/**
 * Where the player is, so the guided run never feels unbounded.
 *
 * Told its position rather than looking it up: an instrument should not need
 * to know the story to draw itself.
 */
export function progress(done: number, total: number, act: number): HTMLElement {
  return el(
    'div',
    { class: 'progress', role: 'img', 'aria-label': `Part ${act} of 3` },
    ...Array.from({ length: total }, (_, i) => el('i', { class: i <= done ? 'on' : '' })),
  );
}

/** The one focusable landmark per screen, so a reader lands on the new beat. */
export function heading(text: string, size: 'lg' | 'sm' | 'big' | 'sr' = 'lg'): HTMLElement {
  const suffix = size === 'lg' ? '' : ` ${size}`;
  return el('h1', { class: `ask${suffix}`, tabindex: '-1' }, text);
}

export interface FrameParts {
  /** Names the beat. Becomes the heading on screens that show no visible one. */
  title: string;
  label: HTMLElement;
  chip: HTMLElement;
  stage: (Node | null)[];
  bottom: (Node | null)[];
  flush?: boolean;
}

export function frame({ title, label, chip, stage, bottom, flush }: FrameParts): HTMLElement {
  const content = stage.filter(Boolean) as Node[];
  // A heading can be nested inside a group, so look through the subtree --
  // checking only the top level silently produces a second one.
  const hasHeading = content.some(
    (n) => n instanceof HTMLElement && (n.classList.contains('ask') || n.querySelector('.ask') !== null),
  );
  return el(
    'div',
    { class: 'enter' },
    el('header', { class: 'top' }, label, chip),
    el(
      'main',
      { class: `stage${flush ? ' flush' : ''}` },
      // Every screen gets exactly one heading, whether or not it shows one.
      ...(hasHeading ? [] : [heading(title, 'sr')]),
      ...content,
    ),
    el('div', { class: 'bottom' }, ...(bottom.filter(Boolean) as Node[])),
  );
}

export function roomLabel(text: string, opponent?: string): HTMLElement {
  return opponent
    ? el('span', { class: 'room label', 'data-o': opponent }, el('i', { class: 'dot' }), text)
    : el('span', { class: 'label', text });
}

export function focusHeading(node: HTMLElement): void {
  const head = node.querySelector<HTMLElement>('.ask');
  if (head) focus(head);
}
