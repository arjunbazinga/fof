/**
 * The journey.
 *
 * Sell the illusion of a stationary world, break it, then rebuild the player's
 * model in front of them. One rule throughout: no mechanism gets named before
 * the player has guessed at it. The paper's vocabulary is the reward for
 * finishing, not the onboarding.
 */
import { el, focus, reducedMotion } from './dom';
import {
  beliefTrace,
  boxMark,
  scoreCurve,
  stripCells,
  stripLabel,
  switchGauge,
} from './figures';
import {
  BEATS,
  JOURNEY,
  RESOLVE_MS,
  RESOLVE_MS_REDUCED,
  TAP_THROUGH_AFTER_MS,
  type Phase,
} from './journey';
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

const GUESSES = [
  { id: 'coin', text: 'A fair coin', right: false },
  { id: 'biased', text: 'A coin, but biased', right: false },
  { id: 'pattern', text: 'A fixed pattern I could learn', right: false },
  { id: 'me', text: 'Something reacting to me', right: true },
] as const;

const ROOM: Record<Opponent, string> = { friend: 'Green room', neutral: 'White room', foe: 'Red room' };

const TELL: Record<Opponent, string> = {
  friend: 'It rewards whatever you do twice in a row.',
  neutral: "It never looked at you at all — the left box just wins 60% of the time.",
  foe: "It puts the reward wherever your recent taps say you’re least likely to go.",
};

const SEEN = 'fof.seen';

export class App {
  private root: HTMLElement;
  private run = new Run();
  private phase: Phase = 'act1';
  /** Index into run.rounds where the current beat began. */
  private mark = 0;
  private guess: string | null = null;
  private locked = false;
  private lockedAt = 0;
  private pending = 0;
  private started = false;
  private lab = { opponent: 'foe' as Opponent, belief: true, alpha: ALPHA_DEFAULT };
  private hidden: Opponent = 'foe';
  /** Where the blind round began, so the verdict can still see it. */
  private blindMark = 0;
  private live: HTMLElement;
  private ui: {
    boxes?: HTMLButtonElement[];
    bar?: HTMLElement;
    fill?: HTMLElement;
    pl?: HTMLElement;
    pr?: HTMLElement;
    chip?: HTMLElement;
    strip?: HTMLElement;
    curve?: HTMLElement;
    note?: HTMLElement;
    head?: HTMLElement;
  } = {};

  constructor(root: HTMLElement) {
    this.root = root;
    this.live = el('div', { class: 'sr', role: 'status', 'aria-live': 'polite' });
    document.body.append(this.live);
    window.addEventListener('keydown', (e) => {
      if (!BEATS[this.phase].play) return;
      if (e.key === 'ArrowLeft') this.tap(0);
      if (e.key === 'ArrowRight') this.tap(1);
    });
    this.render();
    this.started = true;
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
    return BEATS[this.phase].play?.opponent ?? 'neutral';
  }

  private showsBelief(): boolean {
    if (this.phase === 'lab') return this.lab.belief;
    if (this.phase === 'blind') return false;
    return BEATS[this.phase].play?.belief ?? false;
  }

  // ---------------------------------------------------------------- play

  private tap(choice: Choice): void {
    // A second tap while the boxes are open skips ahead, but not so soon that
    // a fumbled double-tap swallows the result.
    if (this.locked) {
      if (performance.now() - this.lockedAt > TAP_THROUGH_AFTER_MS) this.resolve();
      return;
    }
    this.locked = true;
    this.lockedAt = performance.now();

    const round = this.run.step(this.opponent(), choice);
    this.paint(round);
    this.live.textContent = `${round.win ? 'Reward' : 'Empty'}. Score ${summarise(this.rounds()).score}.`;

    this.pending = window.setTimeout(
      () => this.resolve(),
      reducedMotion() ? RESOLVE_MS_REDUCED : RESOLVE_MS,
    );
  }

  private resolve(): void {
    window.clearTimeout(this.pending);
    this.locked = false;
    const beat = BEATS[this.phase];
    if (beat.play && this.rounds().length >= beat.play.taps && beat.next) this.go(beat.next);
    else this.clearBoxes();
  }

  /** Show what was in both boxes, then move the belief. In that order. */
  private paint(round: Round): void {
    this.ui.boxes?.forEach((b, i) => {
      b.classList.toggle('reward', i === round.reward);
      b.classList.toggle('empty', i !== round.reward);
      b.classList.toggle('taken', i === round.choice);
      const state = b.querySelector('.state');
      if (state) state.textContent = i === round.reward ? 'REWARD' : 'EMPTY';
    });
    this.setBelief(this.run.beliefs[round.opponent], true);
    this.setChip();
    this.setStrip();
    this.setCurve();
    this.hint();
  }

  private clearBoxes(): void {
    this.ui.boxes?.forEach((b) => {
      b.classList.remove('reward', 'empty', 'taken');
      const state = b.querySelector('.state');
      if (state) state.textContent = '';
    });
  }

  /**
   * `moved` pulses the bar's frame. Under reduced motion the width snaps
   * instead of sliding, so the pulse is what carries the causal link -- a
   * colour change, which is safe where a sliding one is not.
   */
  private setBelief(b: Belief, moved = false): void {
    if (!this.ui.fill) return;
    const pct = b[0] * 100;
    this.ui.fill.style.width = `${pct.toFixed(1)}%`;
    if (this.ui.pl) this.ui.pl.textContent = `LEFT ${Math.round(pct)}%`;
    if (this.ui.pr) this.ui.pr.textContent = `${Math.round(100 - pct)}% RIGHT`;
    if (moved && this.ui.bar) {
      const bar = this.ui.bar;
      bar.classList.remove('moved');
      void bar.offsetWidth;
      bar.classList.add('moved');
    }
  }

  /** What the chip counts depends on where you are. */
  private chipRounds(): Round[] {
    if (this.phase === 'lab') return this.run.history(this.lab.opponent);
    if (this.phase === 'verdict') return this.blindRounds();
    if (BEATS[this.phase].play) return this.rounds();
    return this.run.rounds;
  }

  private setChip(): void {
    if (!this.ui.chip) return;
    const s = summarise(this.chipRounds());
    this.ui.chip.hidden = this.run.rounds.length === 0;
    this.ui.chip.textContent = `${s.score >= 0 ? '+' : '−'}${Math.abs(s.score)} · ${s.taps} ${s.taps === 1 ? 'tap' : 'taps'}`;
    this.ui.chip.classList.toggle('up', s.score > 0);
    this.ui.chip.classList.toggle('down', s.score < 0);
  }

  private setStrip(): void {
    if (!this.ui.strip) return;
    const recent = this.rounds().slice(-24);
    this.ui.strip.replaceChildren(...stripCells(recent));
    this.ui.strip.setAttribute('aria-label', stripLabel(recent));
  }

  private setCurve(): void {
    if (!this.ui.curve) return;
    let s = 0;
    this.ui.curve.replaceChildren(scoreCurve(this.rounds().map((r) => (s += r.win ? 1 : -1))));
  }

  /** One nudge, and only for a player who is stuck with the answer in view. */
  private hint(): void {
    if (!this.ui.note) return;
    const rounds = this.rounds();
    if (rounds.length !== 5) return;
    if (this.phase === 'reveal' && summarise(rounds).score < 0) {
      this.ui.note.textContent = "It hides the reward where you’re least likely to go.";
    }
    if (this.phase === 'act3' && summarise(rounds).score < 2) {
      this.ui.note.textContent = 'You got good at being unreadable. This one needs to read you.';
    }
  }

  // ---------------------------------------------------------------- chrome

  private render(): void {
    this.ui = {};
    this.root.replaceChildren(this.screen());
    if (this.showsBelief() || this.phase === 'lab') this.setBelief(this.run.beliefs[this.opponent()]);
    // Move the reader to the new beat -- but never steal focus on first paint.
    if (this.started && this.ui.head) focus(this.ui.head);
  }

  private top(): HTMLElement {
    const beat = BEATS[this.phase];
    const chip = el('span', { class: 'chip' });
    this.ui.chip = chip;
    const opponent = this.phase === 'act3' ? 'friend' : this.phase === 'lab' ? this.lab.opponent : undefined;
    const left = opponent
      ? el('span', { class: 'room label', 'data-o': opponent }, el('i', { class: 'dot' }), beat.label)
      : el('span', { class: 'label', text: beat.label });
    const bar = el('header', { class: 'top' }, left, chip);
    this.setChip();
    return bar;
  }

  /** Where the player is, so the journey never feels unbounded. */
  private progress(): HTMLElement | null {
    const act = BEATS[this.phase].act;
    if (!act) return null;
    const done = JOURNEY.indexOf(this.phase);
    return el(
      'div',
      { class: 'progress', role: 'img', 'aria-label': `Part ${act} of 3` },
      ...JOURNEY.map((_, i) => el('i', { class: i <= done ? 'on' : '' })),
    );
  }

  private heading(text: string, small = false, extra = ''): HTMLElement {
    const h = el('h1', { class: `ask${small ? ' sm' : ''}${extra ? ' ' + extra : ''}`, tabindex: '-1' }, text);
    this.ui.head = h;
    return h;
  }

  private beliefBar(caption = 'It expects you to pick'): HTMLElement {
    const fill = el('i');
    const pl = el('span', { class: 'l' });
    const pr = el('span', { class: 'r' });
    const bar = el('div', { class: 'bar' }, fill, pl, pr);
    Object.assign(this.ui, { fill, pl, pr, bar });
    return el('div', { class: 'group' }, el('span', { class: 'label', text: caption }), bar);
  }

  private boxRow(): HTMLElement {
    const make = (i: Choice, name: string) =>
      el(
        'button',
        { class: 'box', type: 'button', onclick: () => this.tap(i), 'aria-label': `${name} box` },
        boxMark(i),
        name,
        el('span', { class: 'state' }),
      );
    const boxes = [make(0, 'Left'), make(1, 'Right')];
    this.ui.boxes = boxes;
    return el('div', { class: 'boxes' }, ...boxes);
  }

  private stripEl(): HTMLElement {
    const strip = el('div', { class: 'strip', role: 'img' });
    this.ui.strip = strip;
    this.setStrip();
    return strip;
  }

  private note(text = ''): HTMLElement {
    const n = el('p', { class: 'sub', text });
    this.ui.note = n;
    return n;
  }

  private frame(stage: Node[], bottom: Node[]): HTMLElement {
    const beat = BEATS[this.phase];
    return el(
      'div',
      { class: 'enter' },
      this.top(),
      el('main', { class: `stage${beat.flush ? ' flush' : ''}` }, ...stage),
      el('div', { class: 'bottom' }, ...(bottom.filter(Boolean) as Node[]), this.progress()),
    );
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

  private actOne(): HTMLElement {
    const first = this.rounds().length === 0;
    return this.frame(
      first
        ? [
            this.heading('One of these boxes has the reward.'),
            el('p', { class: 'sub' }, "Pick one. That’s the whole game."),
          ]
        : [this.stripEl(), this.note('Green means you found it.')],
      [
        this.boxRow(),
        first && localStorage.getItem(SEEN)
          ? el('button', { class: 'ghost', type: 'button', onclick: () => this.go('lab') }, 'Played before — skip to the lab')
          : null,
      ].filter(Boolean) as Node[],
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
      [
        this.heading("Before you go on — what’s deciding where the reward goes?", true),
        el('div', { class: 'cards' }, ...cards),
      ],
      [cta, el('p', { class: 'sub centre' }, "You’ll be scored on this at the end.")],
    );
  }

  private actTwo(): HTMLElement {
    const curve = el('div');
    this.ui.curve = curve;
    this.setCurve();
    return this.frame([curve, this.stripEl(), this.note('Same two boxes.')], [this.boxRow()]);
  }

  /** Reads the transcript rather than assuming the player lost. */
  private notice(): HTMLElement {
    const recent = this.run.rounds.slice(-12);
    const lost = recent.filter((r) => !r.win).length;
    const won = recent.length - lost;
    const [head, sub] =
      lost >= 8
        ? [`You lost ${lost} of the last ${recent.length}.`, 'Still a coin?']
        : won >= 10
          ? [`You won ${won} of the last ${recent.length}.`, "That wasn’t luck. You found its rule without meaning to."]
          : [`Your last ${recent.length}: ${won} up, ${lost} down.`, "Whatever that was, it wasn’t a coin."];
    return this.frame(
      [this.heading(head), el('p', { class: 'sub' }, sub)],
      [el('button', { class: 'cta', type: 'button', onclick: () => this.go('reveal') }, 'Show me why')],
    );
  }

  private reveal(): HTMLElement {
    return this.frame(
      [
        this.heading('This bar has been here since your first tap.', true),
        this.beliefBar(),
        this.note("You just couldn’t see it. Watch what your next tap does to it."),
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
      type: 'range', min: '1', max: String(foe.length), value: String(foe.length),
      'aria-label': 'Scrub through your run',
    }) as HTMLInputElement;

    const draw = () => {
      const at = Number(scrub.value);
      chart.replaceChildren(beliefTrace(beliefs.slice(0, at)));
      const r = foe[at - 1];
      const side = r.belief[0] >= 0.5 ? 'left' : 'right';
      const conf = Math.round(Math.max(r.belief[0], r.belief[1]) * 100);
      caption.innerHTML = `Tap ${at}: it expected <b>${side}</b> at ${conf}% — you went <b>${r.choice === 0 ? 'left' : 'right'}</b>.`;
    };
    scrub.addEventListener('input', draw);
    draw();

    return this.frame(
      [
        this.heading('It was reading you the whole time.', true),
        el('div', { class: 'group' }, chart, scrub, caption),
        el('div', { class: 'strip', role: 'img', 'aria-label': stripLabel(foe) }, ...stripCells(foe)),
      ],
      [el('button', { class: 'cta', type: 'button', onclick: () => this.go('act3') }, 'One more room')],
    );
  }

  private actThree(): HTMLElement {
    return this.frame(
      [
        this.heading('New room. This one wants you to win.', true),
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
        el('span', { class: 'room label', 'data-o': o }, el('i', { class: 'dot' }), ROOM[o]),
        el('span', { class: 'readout', html: `<b>${fmt(s.average)}</b> / ${fmt(CEILING[o].stationary)} per tap` }),
      );
    });

    return this.frame(
      [
        el(
          'div',
          { class: 'group' },
          el('span', { class: 'label', text: 'Your switch rate' }),
          this.heading(`${pct}%`, false, 'big'),
          switchGauge(all.switchRate),
          el('p', { class: 'sub', text: switchCopy(all.switchRate, pct) }),
        ),
        el('div', { class: 'rule' }),
        el(
          'div',
          { class: 'group' },
          el('span', { class: 'label', text: 'You guessed' }),
          el('div', { class: `card ${picked?.right ? 'right' : 'wrong'}` }, `“${picked?.text ?? 'nothing'}” — ${picked?.right ? 'right' : 'wrong'}`),
          el('p', { class: 'sub' }, 'All three rooms ran one rule: a smoothed estimate of your next tap. The only input was you.'),
        ),
        el('div', { class: 'rule' }),
        el('div', { class: 'group' }, el('span', { class: 'label', text: 'Yours vs. the best a memoryless player can do' }), ...rows),
        el('div', { class: 'rule' }),
        el(
          'div',
          { class: 'prose' },
          el('p', { html: 'This is the <b>friend or foe</b> environment from <a href="https://arxiv.org/abs/1711.09883">AI Safety Gridworlds</a> (Leike et al., 2017), §2.2.3. The friend hides the reward where you’re most likely to look, the foe where you’re least likely, and the white room never looks at you at all.' }),
          el('p', { html: 'The paper calls it the suite’s only partially observable environment, “since the environment’s memory is not observed by the agent.” That memory is the bar. Hidden, the best you can do against the red room is break even by being unreadable. Shown, the foe is deterministic and you can win every round — which is the part worth keeping: an adversary is only unbeatable to someone who refuses to model it.' }),
          el('p', { html: 'When DeepMind ran this, Rainbow solved the red room by walking into a wall until random exploration knocked it sideways, then collapsed once that randomness was annealed away.' }),
        ),
      ],
      [
        el('button', { class: 'cta', type: 'button', onclick: () => this.go('lab') }, 'Open the lab'),
        el('button', { class: 'ghost', type: 'button', onclick: () => this.startBlind() }, 'Blind mode — name the room from behaviour alone'),
        el('p', { class: 'credit', html: 'First built in 2017 by <a href="https://twitter.com/arjunsriv">@arjunsriv</a>.' }),
      ],
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
      [
        seg,
        this.lab.belief
          ? this.beliefBar()
          : el('p', { class: 'sub' }, 'Belief hidden — the environment as the paper defines it.'),
        el('div', { class: 'switch' }, el('span', { class: 'label', text: 'Its belief' }), toggle),
        el('div', { class: 'rule' }),
        el(
          'div',
          { class: 'group' },
          el('span', { class: 'label', text: 'Memory — low remembers everything, high only your last tap' }),
          alpha,
          alphaOut,
        ),
        el('div', { class: 'rule' }),
        el('p', {
          class: 'readout',
          html: `You <b>${fmt(s.average)}</b> · optimal stationary <b>${fmt(CEILING[o].stationary)}</b> · model-based <b>${fmt(CEILING[o].modelled)}</b>`,
        }),
        this.stripEl(),
      ],
      [this.boxRow(), el('button', { class: 'ghost', type: 'button', onclick: () => this.startBlind() }, 'Blind mode')],
    );
  }

  private startBlind(): void {
    const pool: Opponent[] = ['friend', 'neutral', 'foe'];
    this.hidden = pool[Math.floor(Math.random() * pool.length)];
    this.run.beliefs[this.hidden] = [0.5, 0.5];
    this.go('blind');
    this.blindMark = this.mark;
  }

  /** The blind round's own transcript, which outlives the beat that made it. */
  private blindRounds(): Round[] {
    return this.run.rounds.slice(this.blindMark);
  }

  /** The paper's actual question: detect the intention rather than be told it. */
  private blindScreen(): HTMLElement {
    const left = BEATS.blind.play!.taps - this.rounds().length;
    return this.frame(
      [
        this.heading('Friend, foe, or neither?', true),
        el('p', { class: 'sub' }, `No colour, no bar. ${left} taps to work out who you’re playing.`),
        this.stripEl(),
      ],
      [this.boxRow(), el('button', { class: 'ghost', type: 'button', onclick: () => this.go('verdict') }, 'Call it now')],
    );
  }

  private verdict(): HTMLElement {
    const cards = (['friend', 'neutral', 'foe'] as Opponent[]).map((k) =>
      el(
        'button',
        { class: 'card', type: 'button', onclick: () => this.callIt(k) },
        k === 'neutral' ? 'Neither — it was random' : `The ${k}`,
      ),
    );
    return this.frame(
      [this.heading('Which one were you playing?', true), el('div', { class: 'cards' }, ...cards)],
      [],
    );
  }

  private callIt(pick: Opponent): void {
    const right = pick === this.hidden;
    const rounds = this.blindRounds();
    this.ui = {};
    this.root.replaceChildren(
      el(
        'div',
        { class: 'enter' },
        this.top(),
        el(
          'main',
          { class: 'stage' },
          this.heading(right ? 'Called it.' : 'Not that one.'),
          el('p', { class: 'sub', html: `It was the <b>${this.hidden}</b>. ${TELL[this.hidden]}` }),
          el('div', { class: 'strip', role: 'img', 'aria-label': stripLabel(rounds) }, ...stripCells(rounds)),
        ),
        el(
          'div',
          { class: 'bottom' },
          el('button', { class: 'cta', type: 'button', onclick: () => this.startBlind() }, 'Again'),
          el('button', { class: 'ghost', type: 'button', onclick: () => this.go('lab') }, 'Back to the lab'),
        ),
      ),
    );
    focus(this.ui.head!);
  }
}

function fmt(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
}

/** Say what the player actually did, not what we hoped they would do. */
function switchCopy(rate: number, pct: number): string {
  if (rate > 0.58) return `A fair coin switches half the time. You switched ${pct}% — the over-alternating the red room feeds on.`;
  if (rate < 0.42) return `A fair coin switches half the time. You switched ${pct}% — you settle, which the green room pays for and the red room punishes.`;
  return `A fair coin switches half the time. You switched ${pct}%, which is close. Being hard to read is rarer than it sounds.`;
}
