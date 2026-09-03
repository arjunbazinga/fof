/**
 * The journey.
 *
 * Three acts: build a wrong model of the world on purpose, break it, then
 * rebuild it in front of the player. The rule everywhere is that no mechanism
 * gets named before the player has guessed at it -- the paper's vocabulary is
 * the reward for finishing, not the onboarding.
 */
import { el, svg, shape, trace, reducedMotion } from './dom';
import {
  ALPHA_DEFAULT,
  CEILING,
  Run,
  summarise,
  type Belief,
  type Choice,
  type Opponent,
  type Round,
} from './engine';

type Phase =
  | 'act1'
  | 'commit'
  | 'act2'
  | 'notice'
  | 'reveal'
  | 'replay'
  | 'act3'
  | 'debrief'
  | 'lab'
  | 'blind'
  | 'verdict';

interface Play {
  opponent: Opponent;
  taps: number;
  belief: boolean;
}

const PLAY: Partial<Record<Phase, Play>> = {
  act1: { opponent: 'neutral', taps: 16, belief: false },
  act2: { opponent: 'foe', taps: 14, belief: false },
  reveal: { opponent: 'foe', taps: 10, belief: true },
  act3: { opponent: 'friend', taps: 12, belief: true },
};

const GUESSES = [
  { id: 'coin', text: 'A fair coin', right: false },
  { id: 'biased', text: 'A coin, but biased', right: false },
  { id: 'pattern', text: 'A fixed pattern I could learn', right: false },
  { id: 'me', text: 'Something reacting to me', right: true },
] as const;

const ROOM_NAME: Record<Opponent, string> = { friend: 'Green room', neutral: 'White room', foe: 'Red room' };
const SEEN = 'fof.seen';

export class App {
  private root: HTMLElement;
  private run = new Run();
  private phase: Phase = 'act1';
  /** Index into run.rounds where the current phase began. */
  private mark = 0;
  private guess: string | null = null;
  private locked = false;
  private lab = { opponent: 'foe' as Opponent, belief: true, alpha: ALPHA_DEFAULT };
  private hidden: Opponent = 'foe';
  private live!: HTMLElement;
  private ui: {
    boxes?: HTMLButtonElement[];
    fill?: HTMLElement;
    pl?: HTMLElement;
    pr?: HTMLElement;
    chip?: HTMLElement;
    strip?: HTMLElement;
    curve?: HTMLElement;
    note?: HTMLElement;
  } = {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.live = el('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
    document.body.append(this.live);
    window.addEventListener('keydown', (e) => {
      if (this.locked || !PLAY[this.phase]) return;
      if (e.key === 'ArrowLeft') this.tap(0);
      if (e.key === 'ArrowRight') this.tap(1);
    });
    this.render();
  }

  // ---------------------------------------------------------------- state

  private rounds(): Round[] {
    return this.run.rounds.slice(this.mark);
  }

  private go(phase: Phase): void {
    this.phase = phase;
    this.mark = this.run.rounds.length;
    this.render();
    window.scrollTo(0, 0);
  }

  private opponent(): Opponent {
    if (this.phase === 'lab') return this.lab.opponent;
    if (this.phase === 'blind') return this.hidden;
    return PLAY[this.phase]!.opponent;
  }

  private showsBelief(): boolean {
    if (this.phase === 'lab') return this.lab.belief;
    if (this.phase === 'blind') return false;
    return PLAY[this.phase]?.belief ?? false;
  }

  // ---------------------------------------------------------------- play

  private tap(choice: Choice): void {
    if (this.locked) return;
    this.locked = true;
    const opponent = this.opponent();
    const round = this.run.step(opponent, choice);
    this.paint(round);
    this.live.textContent = `${round.win ? 'Reward' : 'Empty'}. Score ${this.score()}.`;

    window.setTimeout(
      () => {
        this.locked = false;
        const cfg = PLAY[this.phase];
        if (cfg && this.rounds().length >= cfg.taps) this.advance();
        else this.clearBoxes();
      },
      reducedMotion() ? 420 : 820,
    );
  }

  private advance(): void {
    const next: Partial<Record<Phase, Phase>> = {
      act1: 'commit',
      act2: 'notice',
      reveal: 'replay',
      act3: 'debrief',
    };
    const to = next[this.phase];
    if (to) this.go(to);
  }

  private score(): number {
    return summarise(this.rounds()).score;
  }

  /** Show what was in both boxes, then move the belief -- in that order. */
  private paint(round: Round): void {
    const boxes = this.ui.boxes;
    if (boxes) {
      boxes.forEach((b, i) => {
        b.disabled = true;
        b.classList.toggle('reward', i === round.reward);
        b.classList.toggle('empty', i !== round.reward);
        b.classList.toggle('taken', i === round.choice);
        const state = b.querySelector('.state');
        if (state) state.textContent = i === round.reward ? 'REWARD' : 'EMPTY';
      });
    }
    this.setBelief(this.run.beliefs[round.opponent]);
    this.setChip();
    this.setStrip();
    this.setCurve();
    this.hint();
  }

  private clearBoxes(): void {
    this.ui.boxes?.forEach((b) => {
      b.disabled = false;
      b.classList.remove('reward', 'empty', 'taken');
      const state = b.querySelector('.state');
      if (state) state.textContent = '';
    });
  }

  private setBelief(b: Belief): void {
    if (!this.ui.fill) return;
    const pct = b[0] * 100;
    this.ui.fill.style.width = `${pct.toFixed(1)}%`;
    if (this.ui.pl) this.ui.pl.textContent = `LEFT ${Math.round(pct)}%`;
    if (this.ui.pr) this.ui.pr.textContent = `${Math.round(100 - pct)}% RIGHT`;
  }

  private setChip(): void {
    if (!this.ui.chip) return;
    const s = summarise(this.chipRounds());
    this.ui.chip.textContent = `${s.score >= 0 ? '+' : '−'}${Math.abs(s.score)} · ${s.taps} ${s.taps === 1 ? 'tap' : 'taps'}`;
    this.ui.chip.classList.toggle('up', s.score > 0);
    this.ui.chip.classList.toggle('down', s.score < 0);
  }

  private setStrip(): void {
    if (!this.ui.strip) return;
    this.ui.strip.replaceChildren(...stripCells(this.rounds().slice(-24)));
  }

  private setCurve(): void {
    if (!this.ui.curve) return;
    let s = 0;
    const running = this.rounds().map((r) => (s += r.win ? 1 : -1));
    this.ui.curve.replaceChildren(scoreCurve(running));
  }

  /** One nudge, only if the player is stuck with the instrument in front of them. */
  private hint(): void {
    if (!this.ui.note) return;
    const rounds = this.rounds();
    if (this.phase === 'reveal' && rounds.length === 5 && summarise(rounds).score < 0) {
      this.ui.note.textContent = 'It hides the reward where you are least likely to go.';
    }
    if (this.phase === 'act3' && rounds.length === 5 && summarise(rounds).score < 2) {
      this.ui.note.textContent = 'You got good at being unreadable. This one needs to read you.';
    }
  }

  // ---------------------------------------------------------------- chrome

  private render(): void {
    this.ui = {};
    const screen = this.screen();
    this.root.replaceChildren(screen);
    if (this.showsBelief() || this.phase === 'lab') {
      this.setBelief(this.run.beliefs[this.opponent()]);
    }
  }

  /** What the score chip is counting depends on where you are. */
  private chipRounds(): Round[] {
    if (this.phase === 'lab') return this.run.history(this.lab.opponent);
    if (PLAY[this.phase] || this.phase === 'blind') return this.rounds();
    return this.run.rounds;
  }

  private top(label: string, opponent?: Opponent): HTMLElement {
    const chip = el('span', { class: 'chip' });
    this.ui.chip = chip;
    const left = opponent
      ? el('span', { class: 'room label', 'data-o': opponent }, el('i', { class: 'dot' }), label)
      : el('span', { class: 'label', text: label });
    const bar = el('header', { class: 'top' }, left, chip);
    this.setChip();
    return bar;
  }

  private beliefBar(caption = 'It expects you to pick'): HTMLElement {
    const fill = el('i');
    const pl = el('span', { class: 'l' });
    const pr = el('span', { class: 'r' });
    this.ui.fill = fill;
    this.ui.pl = pl;
    this.ui.pr = pr;
    return el(
      'div',
      { class: 'belief' },
      el('span', { class: 'label', text: caption }),
      el('div', { class: 'bar', role: 'img', 'aria-label': caption }, fill, pl, pr),
    );
  }

  private boxRow(): HTMLElement {
    const make = (i: Choice, name: string) =>
      el(
        'button',
        {
          class: 'box',
          type: 'button',
          onclick: () => this.tap(i),
          'aria-label': `${name} box`,
        },
        el('span', { class: 'mark', text: i === 0 ? '◧' : '◨' }),
        name,
        el('span', { class: 'state' }),
      );
    const boxes = [make(0, 'Left'), make(1, 'Right')];
    this.ui.boxes = boxes;
    return el('div', { class: 'boxes' }, ...boxes);
  }

  private stripEl(): HTMLElement {
    const strip = el('div', { class: 'strip' });
    this.ui.strip = strip;
    this.setStrip();
    return strip;
  }

  private note(text = ''): HTMLElement {
    const n = el('p', { class: 'sub', text });
    this.ui.note = n;
    return n;
  }

  // ---------------------------------------------------------------- screens

  private screen(): HTMLElement {
    switch (this.phase) {
      case 'act1': return this.actOne();
      case 'commit': return this.commit();
      case 'act2': return this.actTwo();
      case 'notice': return this.notice();
      case 'reveal': return this.reveal();
      case 'replay': return this.replay();
      case 'act3': return this.actThree();
      case 'debrief': return this.debrief();
      case 'lab': return this.labScreen();
      case 'blind': return this.blindScreen();
      case 'verdict': return this.verdict();
    }
  }

  private frame(top: HTMLElement, stage: Node[], bottom: Node[], align: 'centre' | 'top' = 'centre'): HTMLElement {
    return el(
      'div',
      { class: 'enter' },
      top,
      el('main', { class: `stage${align === 'top' ? ' top' : ''}` }, ...stage),
      el('div', { class: 'bottom' }, ...bottom),
    );
  }

  /** Act one -- the neutral bandit really is stationary, so the prior is honest. */
  private actOne(): HTMLElement {
    const first = this.rounds().length === 0;
    const skip =
      first && localStorage.getItem(SEEN)
        ? el('button', { class: 'ghost', type: 'button', onclick: () => this.go('lab') }, 'Played before — skip to the lab')
        : null;
    return this.frame(
      this.top('Round one'),
      first
        ? [
            el('h1', { class: 'ask' }, 'One of these boxes has the reward.'),
            el('p', { class: 'sub' }, 'Pick one. That is the whole game.'),
          ]
        : [this.stripEl(), this.note('Green won. Keep going.')],
      [this.boxRow(), skip].filter(Boolean) as Node[],
    );
  }

  private commit(): HTMLElement {
    const cta = el('button', { class: 'cta', type: 'button', disabled: true }, 'Lock it in');
    const cards = GUESSES.map((g) =>
      el(
        'button',
        {
          class: 'card',
          type: 'button',
          'aria-pressed': 'false',
          onclick: (e: Event) => {
            this.guess = g.id;
            cards.forEach((c) => c.setAttribute('aria-pressed', 'false'));
            (e.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true');
            cta.disabled = false;
          },
        },
        g.text,
      ),
    );
    cta.addEventListener('click', () => this.go('act2'));
    return this.frame(
      this.top('Hold on'),
      [
        el('h1', { class: 'ask sm' }, 'Before you keep going: what is deciding where the reward goes?'),
        el('div', { class: 'cards' }, ...cards),
      ],
      [cta, el('p', { class: 'sub', style: 'text-align:center' }, 'You will be scored on this at the end.')],
    );
  }

  /** Act two -- the foe, swapped in with no announcement. */
  private actTwo(): HTMLElement {
    const curve = el('div');
    this.ui.curve = curve;
    this.setCurve();
    return this.frame(
      this.top('Round two'),
      [curve, this.stripEl(), this.note('Same two boxes.')],
      [this.boxRow()],
    );
  }

  private notice(): HTMLElement {
    const recent = this.run.rounds.slice(-12);
    const lost = recent.filter((r) => !r.win).length;
    const won = recent.length - lost;
    const [head, sub] =
      lost >= 8
        ? [`You lost ${lost} of the last ${recent.length}.`, 'Still a coin?']
        : won >= 10
          ? [`You won ${won} of the last ${recent.length}.`, 'That was not luck. You found its rule without knowing it.']
          : [`Your last ${recent.length}: ${won} up, ${lost} down.`, 'Whatever that was, it was not a coin.'];
    return this.frame(
      this.top('Something changed'),
      [el('h1', { class: 'ask' }, head), el('p', { class: 'sub' }, sub)],
      [el('button', { class: 'cta', type: 'button', onclick: () => this.go('reveal') }, 'Show me why')],
    );
  }

  /** The turn: hand over the hidden state and let the player watch it move. */
  private reveal(): HTMLElement {
    return this.frame(
      this.top('Its head', 'foe'),
      [
        el('h1', { class: 'ask sm' }, 'This bar has been here since your first tap.'),
        this.beliefBar(),
        this.note('You just could not see it. Watch what your next tap does to it.'),
      ],
      [this.boxRow()],
    );
  }

  private replay(): HTMLElement {
    const foe = this.run.history('foe');
    const beliefs = foe.map((r) => r.belief[0]);
    const chart = el('div');
    const caption = el('p', { class: 'sub' });
    const scrub = el('input', {
      type: 'range',
      min: '1',
      max: String(foe.length),
      value: String(foe.length),
      'aria-label': 'Scrub through your run',
    }) as HTMLInputElement;

    const draw = () => {
      const at = Number(scrub.value);
      chart.replaceChildren(beliefTrace(beliefs.slice(0, at), foe.slice(0, at)));
      const r = foe[at - 1];
      caption.innerHTML = `Tap ${at}: it expected <b>${r.belief[0] >= 0.5 ? 'left' : 'right'}</b> at ${Math.round(Math.max(r.belief[0], r.belief[1]) * 100)}% — you went <b>${r.choice === 0 ? 'left' : 'right'}</b>.`;
    };
    scrub.addEventListener('input', draw);
    draw();

    return this.frame(
      this.top('Replay', 'foe'),
      [
        el('h1', { class: 'ask sm' }, 'It was reading you the whole time.'),
        chart,
        scrub,
        caption,
        el('div', { class: 'strip' }, ...stripCells(foe)),
      ],
      [el('button', { class: 'cta', type: 'button', onclick: () => this.go('act3') }, 'One more room')],
      'top',
    );
  }

  /** Act three -- the reversal. Unpredictability is now exactly the wrong habit. */
  private actThree(): HTMLElement {
    return this.frame(
      this.top(ROOM_NAME.friend, 'friend'),
      [
        el('h1', { class: 'ask sm' }, 'New room. This one is trying to help you.'),
        this.beliefBar(),
        this.note('Same bar, same rule, opposite intent.'),
      ],
      [this.boxRow()],
    );
  }

  private debrief(): HTMLElement {
    localStorage.setItem(SEEN, '1');
    const all = summarise(this.run.rounds);
    const picked = GUESSES.find((g) => g.id === this.guess);
    const pct = Math.round(all.switchRate * 100);

    const rows = (['neutral', 'foe', 'friend'] as Opponent[]).map((o) => {
      const s = summarise(this.run.history(o));
      return el(
        'div',
        { class: 'row' },
        el('span', { class: 'room label', 'data-o': o }, el('i', { class: 'dot' }), ROOM_NAME[o]),
        el('span', { class: 'readout', html: `<b>${fmt(s.average)}</b> / ${fmt(CEILING[o].stationary)} per tap` }),
      );
    });

    return this.frame(
      this.top('Debrief'),
      [
        el(
          'div',
          { class: 'stat' },
          el('span', { class: 'label', text: 'Your switch rate' }),
          el('span', { class: 'big', text: `${pct}%` }),
          switchGauge(all.switchRate),
          el('p', { class: 'sub', html: switchCopy(all.switchRate, pct) }),
        ),
        el('div', { class: 'rule' }),
        el(
          'div',
          { class: 'stat' },
          el('span', { class: 'label', text: 'You guessed' }),
          el(
            'div',
            { class: `card ${picked?.right ? 'right' : 'wrong'}` },
            `“${picked?.text ?? 'nothing'}” — ${picked?.right ? 'right' : 'wrong'}`,
          ),
          el('p', {
            class: 'sub',
            html: 'All three rooms ran the same rule: an exponentially smoothed estimate of your next tap. The only input was you.',
          }),
        ),
        el('div', { class: 'rule' }),
        el('div', { class: 'stat' }, el('span', { class: 'label', text: 'Yours vs. the best a memoryless player can do' }), ...rows),
        el('div', { class: 'rule' }),
        el(
          'div',
          { class: 'prose' },
          el('p', {
            html: 'This is the <b>friend or foe</b> environment from <a href="https://arxiv.org/abs/1711.09883">AI Safety Gridworlds</a> (Leike et al., 2017), §2.2.3. Each room hides the reward using an exponentially smoothed estimate of your next tap — the friend puts it where you are most likely to go, the foe where you are least likely, and the white room never looks at you at all.',
          }),
          el('p', {
            html: 'The paper calls it the suite\u2019s only partially observable environment, "since the environment\u2019s memory is not observed by the agent." That memory is the bar. Hidden, the best you can do against the red room is break even by being unreadable. Shown, the foe is deterministic and you can win every single round — which is the part worth remembering: an adversary is only unbeatable to someone who refuses to model it.',
          }),
          el('p', {
            html: 'When DeepMind ran this, Rainbow solved the red room by learning to walk into a wall until random exploration knocked it sideways, then collapsed once that randomness was annealed away. A2C found a stochastic policy and nearly solved all three rooms.',
          }),
        ),
      ],
      [
        el('button', { class: 'cta', type: 'button', onclick: () => this.go('lab') }, 'Open the lab'),
        el('button', { class: 'ghost', type: 'button', onclick: () => this.startBlind() }, 'Blind mode — name the room from behaviour alone'),
      ],
      'top',
    );
  }

  private labScreen(): HTMLElement {
    const o = this.lab.opponent;
    const seg = el(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'Opponent' },
      ...(['friend', 'neutral', 'foe'] as Opponent[]).map((k) =>
        el(
          'button',
          {
            type: 'button',
            'aria-pressed': String(k === o),
            onclick: () => {
              this.lab.opponent = k;
              this.mark = this.run.rounds.length;
              this.render();
            },
          },
          k,
        ),
      ),
    );

    const alpha = el('input', {
      type: 'range', min: '0.02', max: '1', step: '0.01',
      value: String(this.lab.alpha), 'aria-label': 'Memory',
    }) as HTMLInputElement;
    const alphaOut = el('span', { class: 'readout', html: `<b>α ${this.lab.alpha.toFixed(2)}</b>` });
    alpha.addEventListener('input', () => {
      this.lab.alpha = Number(alpha.value);
      this.run.alpha = this.lab.alpha;
      alphaOut.innerHTML = `<b>α ${this.lab.alpha.toFixed(2)}</b>`;
    });

    const toggle = el(
      'button',
      {
        type: 'button',
        'aria-pressed': String(this.lab.belief),
        onclick: () => {
          this.lab.belief = !this.lab.belief;
          this.render();
        },
      },
      this.lab.belief ? 'shown' : 'hidden',
    );

    const s = summarise(this.run.history(o));
    return this.frame(
      this.top('Lab', o),
      [
        seg,
        this.lab.belief ? this.beliefBar() : el('p', { class: 'sub' }, 'Belief hidden — this is the environment as the paper defines it.'),
        el('div', { class: 'switch' }, el('span', { class: 'label', text: 'Its belief' }), toggle),
        el('div', { class: 'rule' }),
        el('div', {}, el('span', { class: 'label', text: 'Memory — low α remembers everything, high α only your last tap' }), alpha, alphaOut),
        el('div', { class: 'rule' }),
        el('p', {
          class: 'readout',
          html: `You <b>${fmt(s.average)}</b> · optimal stationary <b>${fmt(CEILING[o].stationary)}</b> · model-based <b>${fmt(CEILING[o].modelled)}</b>`,
        }),
        this.stripEl(),
      ],
      [
        this.boxRow(),
        el('button', { class: 'ghost', type: 'button', onclick: () => this.startBlind() }, 'Blind mode'),
      ],
      'top',
    );
  }

  private startBlind(): void {
    const pool: Opponent[] = ['friend', 'neutral', 'foe'];
    this.hidden = pool[Math.floor(Math.random() * pool.length)];
    this.run.beliefs[this.hidden] = [0.5, 0.5];
    this.go('blind');
  }

  /** The paper's actual question: detect the intention, don't be told it. */
  private blindScreen(): HTMLElement {
    const done = el('button', { class: 'cta', type: 'button', onclick: () => this.go('verdict') }, 'Name the room');
    return this.frame(
      this.top('Blind'),
      [
        el('h1', { class: 'ask sm' }, 'Friend, foe, or neither?'),
        el('p', { class: 'sub' }, 'No colour, no belief bar. Work it out from how it plays, then call it.'),
        this.stripEl(),
      ],
      [this.boxRow(), done],
    );
  }

  private verdict(): HTMLElement {
    const cards = (['friend', 'neutral', 'foe'] as Opponent[]).map((k) =>
      el(
        'button',
        {
          class: 'card',
          type: 'button',
          onclick: () => {
            const right = k === this.hidden;
            this.root.replaceChildren(
              this.frame(
                this.top(right ? 'Called it' : 'Not that one'),
                [
                  el('h1', { class: 'ask' }, right ? 'Right.' : 'Wrong.'),
                  el('p', { class: 'sub', html: `It was the <b>${this.hidden}</b>. ${BLIND_TELL[this.hidden]}` }),
                  el('div', { class: 'strip' }, ...stripCells(this.rounds())),
                ],
                [
                  el('button', { class: 'cta', type: 'button', onclick: () => this.startBlind() }, 'Again'),
                  el('button', { class: 'ghost', type: 'button', onclick: () => this.go('lab') }, 'Back to the lab'),
                ],
              ),
            );
          },
        },
        k === 'neutral' ? 'Neither — it was random' : `The ${k}`,
      ),
    );
    return this.frame(
      this.top('Blind'),
      [el('h1', { class: 'ask sm' }, 'Which one were you playing?'), el('div', { class: 'cards' }, ...cards)],
      [],
    );
  }
}

const BLIND_TELL: Record<Opponent, string> = {
  friend: 'It rewards whatever you do twice in a row.',
  neutral: 'It never looked at you at all — the left box just wins 60% of the time.',
  foe: 'It puts the reward wherever your recent taps say you are least likely to go.',
};

/** Say what the player actually did, not what we hoped they would do. */
function switchCopy(rate: number, pct: number): string {
  if (rate > 0.58) return `A fair coin switches 50% of the time. You switched ${pct}% — the over-alternating that the red room feeds on.`;
  if (rate < 0.42) return `A fair coin switches 50% of the time. You switched ${pct}% — you settle, which the green room pays for and the red room punishes.`;
  return `A fair coin switches 50% of the time. You switched ${pct}%, which is close. Being hard to read is rarer than it sounds.`;
}

function fmt(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
}

function stripCells(rounds: readonly Round[]): HTMLElement[] {
  return rounds.map((r) =>
    el('b', { class: r.win ? 'w' : 'l', title: r.choice === 0 ? 'left' : 'right' }, r.choice === 0 ? 'L' : 'R'),
  );
}

function scoreCurve(running: readonly number[]): SVGSVGElement {
  const w = 300;
  const h = 78;
  const span = Math.max(4, ...running.map((v) => Math.abs(v)));
  const norm = running.map((v) => 0.5 + v / (span * 2));
  const zero = 3 + 0.5 * (h - 6);
  return svg(
    { viewBox: `0 0 ${w} ${h}`, class: 'figure', role: 'img', 'aria-label': 'Your running score' },
    shape('line', { x1: 0, y1: zero, x2: w, y2: zero, stroke: 'var(--rule)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    shape('polyline', {
      points: trace(norm, w, h),
      fill: 'none',
      stroke: running[running.length - 1] < 0 ? 'var(--miss)' : 'var(--win)',
      'stroke-width': 2.2,
    }),
  );
}

function beliefTrace(beliefs: readonly number[], rounds: readonly Round[]): SVGSVGElement {
  const w = 300;
  const h = 92;
  const kids: SVGElement[] = [
    shape('line', { x1: 0, y1: h / 2, x2: w, y2: h / 2, stroke: 'var(--rule)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }),
    shape('polyline', { points: trace(beliefs, w, h), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }),
  ];
  const last = rounds[rounds.length - 1];
  if (last && beliefs.length > 1) {
    const x = w;
    const y = 3 + (1 - beliefs[beliefs.length - 1]) * (h - 6);
    kids.push(shape('circle', { cx: x - 1, cy: y, r: 3.2, fill: 'var(--accent)' }));
  }
  return svg(
    { viewBox: `0 0 ${w} ${h}`, class: 'figure', role: 'img', 'aria-label': 'What it believed, tap by tap' },
    ...kids,
  );
}

function switchGauge(rate: number): SVGSVGElement {
  const w = 300;
  const h = 26;
  return svg(
    { viewBox: `0 0 ${w} ${h}`, class: 'figure', role: 'img', 'aria-label': `Switch rate ${Math.round(rate * 100)} percent against a coin's 50` },
    shape('rect', { x: 0, y: 6, width: w, height: 14, fill: 'var(--sunk)', stroke: 'var(--rule)' }),
    shape('rect', { x: 0, y: 6, width: Math.max(1, rate * w), height: 14, fill: 'var(--accent)' }),
    shape('line', { x1: w / 2, y1: 0, x2: w / 2, y2: h, stroke: 'var(--miss)', 'stroke-width': 1.6 }),
  );
}
