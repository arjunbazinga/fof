/**
 * One builder per beat. Each is a function of the session and returns its node
 * plus the hooks the app calls as taps resolve -- so a screen owns its own
 * live elements and nothing outside it holds a reference.
 */
import { el } from './dom';
import { beliefTrace, choiceStrip, scoreCurve, stripLabel, switchGauge } from './figures';
import {
  beliefBar,
  boxes,
  chip,
  frame,
  heading,
  progress,
  roomLabel,
  strip,
  type Boxes,
} from './instruments';
import { COPY } from '../journey/copy';
import type { Phase } from '../journey/beats';
import type { Session } from '../journey/session';
import { CEILING, summarise, type Choice, type Opponent, type Round } from '../engine';

export interface Screen {
  node: HTMLElement;
  /** A tap has landed and both boxes are open. */
  onRound?(round: Round): void;
  /** The boxes have closed and the next tap is allowed. */
  onClear?(): void;
}

export interface Actions {
  tap(choice: Choice): void;
  goto(phase: Phase): void;
  commit(id: string): void;
  startBlind(): void;
  callIt(pick: Opponent): void;
  setOpponent(opponent: Opponent): void;
  setAlpha(alpha: number): void;
  toggleBelief(): void;
}

/** Chrome every screen shares: the beat's label, its score chip, its progress. */
function shell(s: Session, opponent?: Opponent) {
  const c = chip();
  c.set(summarise(s.chipRounds()), s.run.rounds.length > 0);
  return {
    chip: c,
    label: roomLabel(s.beat.label, opponent),
    progress: progress(s.phase),
    refresh: () => c.set(summarise(s.chipRounds()), s.run.rounds.length > 0),
  };
}

/** The common shape of a beat the player taps through. */
function playable(
  s: Session,
  a: Actions,
  parts: {
    stage: (Node | null)[];
    /** Controls that sit under the boxes, above the progress rail. */
    controls?: (Node | null)[];
    opponent?: Opponent;
    bar?: ReturnType<typeof beliefBar>;
  },
  live?: (round: Round) => void,
): Screen {
  const sh = shell(s, parts.opponent);
  const box: Boxes = boxes((c) => a.tap(c));
  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: parts.stage,
      bottom: [box.node, ...(parts.controls ?? []), sh.progress],
      flush: s.beat.flush,
    }),
    onRound(round) {
      box.show(round);
      sh.refresh();
      parts.bar?.set(s.run.beliefs[round.opponent], true);
      live?.(round);
    },
    onClear: () => box.clear(),
  };
}

// ---------------------------------------------------------------- act one

export function actOne(s: Session, a: Actions): Screen {
  const first = s.rounds().length === 0;
  const rows = strip();
  rows.set(s.rounds());
  const note = el('p', { class: 'sub', text: COPY.actOne.note });
  const returning = first && localStorage.getItem('fof.seen');
  return playable(
    s,
    a,
    {
      stage: first
        ? [heading(COPY.open.ask), el('p', { class: 'sub' }, COPY.open.sub)]
        : [rows.node, note],
      controls: returning
        ? [el('button', { class: 'ghost', type: 'button', onclick: () => a.goto('lab') }, COPY.open.skip)]
        : [],
    },
    () => rows.set(s.rounds()),
  );
}

export function commit(s: Session, a: Actions): Screen {
  const sh = shell(s);
  const cta = el('button', { class: 'cta', type: 'button', disabled: true }, COPY.commit.cta);
  let picked: string | null = null;
  const cards = COPY.guesses.map((g) =>
    el(
      'button',
      {
        class: 'card',
        type: 'button',
        'aria-pressed': 'false',
        onclick: (e: Event) => {
          picked = g.id;
          cards.forEach((c) => c.setAttribute('aria-pressed', 'false'));
          (e.currentTarget as HTMLElement).setAttribute('aria-pressed', 'true');
          cta.disabled = false;
        },
      },
      g.text,
    ),
  );
  cta.addEventListener('click', () => picked && a.commit(picked));
  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: [heading(COPY.commit.ask, 'sm'), el('div', { class: 'cards' }, ...cards)],
      bottom: [cta, el('p', { class: 'sub centre' }, COPY.commit.sub), sh.progress],
    }),
  };
}

// ---------------------------------------------------------------- act two

export function actTwo(s: Session, a: Actions): Screen {
  const curve = el('div');
  const rows = strip();
  const draw = () => {
    let n = 0;
    curve.replaceChildren(scoreCurve(s.rounds().map((r) => (n += r.win ? 1 : -1))));
    rows.set(s.rounds());
  };
  draw();
  return playable(
    s,
    a,
    {
      stage: [
        el(
          'div',
          { class: 'group' },
          el('span', { class: 'label', text: COPY.actTwo.caption }),
          curve,
          rows.node,
        ),
        el('p', { class: 'sub', text: COPY.actTwo.note }),
      ],
    },
    draw,
  );
}

export function notice(s: Session, a: Actions): Screen {
  const sh = shell(s);
  const recent = s.run.rounds.slice(-12);
  const lost = recent.filter((r) => !r.win).length;
  const won = recent.length - lost;
  const [head, sub] =
    lost >= 8
      ? COPY.notice.lost(lost, recent.length)
      : won >= 10
        ? COPY.notice.won(won, recent.length)
        : COPY.notice.mixed(won, lost, recent.length);
  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: [heading(head), el('p', { class: 'sub' }, sub)],
      bottom: [
        el('button', { class: 'cta', type: 'button', onclick: () => a.goto('reveal') }, COPY.notice.cta),
        sh.progress,
      ],
    }),
  };
}

export function reveal(s: Session, a: Actions): Screen {
  const bar = beliefBar(COPY.reveal.caption);
  bar.set(s.run.beliefs.foe);
  const note = el('p', { class: 'sub', text: COPY.reveal.note });
  return playable(
    s,
    a,
    { stage: [heading(COPY.reveal.ask, 'sm'), bar.node, note], opponent: 'foe', bar },
    () => {
      // One nudge, and only for a player stuck with the answer in front of them.
      if (s.rounds().length === 4 && summarise(s.rounds()).score < 0) note.textContent = COPY.reveal.hint;
    },
  );
}

/**
 * The payoff. The belief trace, the taps that produced it, and the scrubber all
 * share one x-axis, so the two series can be read against each other -- which
 * is the entire point of the screen.
 */
export function replay(s: Session, a: Actions): Screen {
  const sh = shell(s, 'foe');
  const foe = s.run.history('foe');
  const beliefs = foe.map((r) => r.belief[0]);
  const chart = el('div', { class: 'trace' });
  const rowsHost = el('div');
  const caption = el('p', { class: 'sub' });
  const scrub = el('input', {
    type: 'range', min: '1', max: String(foe.length), value: String(foe.length),
    'aria-label': 'Scrub through your run',
  }) as HTMLInputElement;

  const draw = () => {
    const at = Number(scrub.value);
    chart.replaceChildren(beliefTrace(beliefs, at));
    rowsHost.replaceChildren(choiceStrip(foe, { aligned: true, at }));
    const r = foe[at - 1];
    caption.innerHTML = COPY.replay.at(
      at,
      r.belief[0] >= 0.5 ? 'left' : 'right',
      Math.round(Math.max(r.belief[0], r.belief[1]) * 100),
      r.choice === 0 ? 'left' : 'right',
    );
  };
  scrub.addEventListener('input', draw);
  draw();

  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: [
        heading(COPY.replay.ask, 'sm'),
        el(
          'figure',
          { class: 'aligned-figure', 'aria-label': stripLabel(foe) },
          el('span', { class: 'label', text: COPY.replay.beliefLabel }),
          // LEFT above and RIGHT below: these name the trace's vertical axis,
          // and side by side they read as if they named the horizontal one.
          el('span', { class: 'axis', text: 'LEFT' }),
          chart,
          el('span', { class: 'axis', text: 'RIGHT' }),
          el('span', { class: 'label', text: COPY.replay.choiceLabel }),
          rowsHost,
          scrub,
        ),
        caption,
      ],
      bottom: [
        el('button', { class: 'cta', type: 'button', onclick: () => a.goto('act3') }, COPY.replay.cta),
        sh.progress,
      ],
    }),
  };
}

// ---------------------------------------------------------------- act three

export function actThree(s: Session, a: Actions): Screen {
  const bar = beliefBar(COPY.reveal.caption);
  bar.set(s.run.beliefs.friend);
  const note = el('p', { class: 'sub', text: COPY.actThree.note });
  return playable(
    s,
    a,
    { stage: [heading(COPY.actThree.ask, 'sm'), bar.node, note], opponent: 'friend', bar },
    () => {
      if (s.rounds().length === 4 && summarise(s.rounds()).score < 2) note.textContent = COPY.actThree.hint;
    },
  );
}

export function debrief(s: Session, a: Actions): Screen {
  localStorage.setItem('fof.seen', '1');
  const sh = shell(s);
  const all = summarise(s.run.rounds);
  const picked = COPY.guesses.find((g) => g.id === s.guess);
  const pct = Math.round(all.switchRate * 100);

  const rows = (['neutral', 'foe', 'friend'] as Opponent[]).map((o) => {
    const stats = summarise(s.run.history(o));
    return el(
      'div',
      { class: 'row' },
      roomLabel(COPY.room[o], o),
      el('span', { class: 'readout', html: `<b>${fmt(stats.average)}</b> / ${fmt(CEILING[o].stationary)} per tap` }),
    );
  });

  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: [
        el(
          'div',
          { class: 'group' },
          el('span', { class: 'label', text: COPY.debrief.switchLabel }),
          heading(`${pct}%`, 'big'),
          switchGauge(all.switchRate),
          el('p', { class: 'sub', text: COPY.debrief.switched(all.switchRate, pct) }),
        ),
        el('div', { class: 'rule' }),
        el(
          'div',
          { class: 'group' },
          el('span', { class: 'label', text: COPY.debrief.guessLabel }),
          el(
            'div',
            { class: `card ${picked?.right ? 'right' : 'wrong'}` },
            `“${picked?.text ?? 'nothing'}” — ${picked?.right ? 'right' : 'wrong'}`,
          ),
          el('p', { class: 'sub' }, COPY.debrief.rule),
        ),
        el('div', { class: 'rule' }),
        el('div', { class: 'group' }, el('span', { class: 'label', text: COPY.debrief.ceilingLabel }), ...rows),
        el('div', { class: 'rule' }),
        el('div', { class: 'prose' }, ...COPY.debrief.paper.map((html) => el('p', { html }))),
      ],
      bottom: [
        el('button', { class: 'cta', type: 'button', onclick: () => a.goto('lab') }, COPY.debrief.lab),
        el('button', { class: 'ghost', type: 'button', onclick: () => a.startBlind() }, COPY.debrief.blind),
        el('p', { class: 'credit', html: COPY.debrief.credit }),
      ],
      flush: true,
    }),
  };
}

// ---------------------------------------------------------------- past the credits

export function lab(s: Session, a: Actions): Screen {
  const o = s.lab.opponent;
  const seg = el(
    'div',
    { class: 'seg', role: 'group', 'aria-label': 'Opponent' },
    ...(['friend', 'neutral', 'foe'] as Opponent[]).map((k) =>
      el('button', { type: 'button', 'aria-pressed': String(k === o), onclick: () => a.setOpponent(k) }, k),
    ),
  );
  const alpha = el('input', {
    type: 'range', min: '0.02', max: '1', step: '0.01', value: String(s.lab.alpha), 'aria-label': 'Memory',
  }) as HTMLInputElement;
  const alphaOut = el('span', { class: 'readout', html: `<b>α ${s.lab.alpha.toFixed(2)}</b>` });
  alpha.addEventListener('input', () => {
    a.setAlpha(Number(alpha.value));
    alphaOut.innerHTML = `<b>α ${Number(alpha.value).toFixed(2)}</b>`;
  });

  const bar = s.lab.belief ? beliefBar(COPY.reveal.caption) : null;
  bar?.set(s.run.beliefs[o]);
  const rows = strip();
  rows.set(s.rounds());
  const stats = summarise(s.run.history(o));

  return playable(
    s,
    a,
    {
      opponent: o,
      bar: bar ?? undefined,
      stage: [
        seg,
        bar ? bar.node : el('p', { class: 'sub' }, COPY.lab.hidden),
        el(
          'div',
          { class: 'switch' },
          el('span', { class: 'label', text: COPY.lab.beliefLabel }),
          el(
            'button',
            { type: 'button', 'aria-pressed': String(s.lab.belief), onclick: () => a.toggleBelief() },
            s.lab.belief ? 'shown' : 'hidden',
          ),
        ),
        el('div', { class: 'rule' }),
        el('div', { class: 'group' }, el('span', { class: 'label', text: COPY.lab.memory }), alpha, alphaOut),
        el('div', { class: 'rule' }),
        el('p', {
          class: 'readout',
          html: `You <b>${fmt(stats.average)}</b> · optimal stationary <b>${fmt(CEILING[o].stationary)}</b> · model-based <b>${fmt(CEILING[o].modelled)}</b>`,
        }),
        rows.node,
      ],
      controls: [
        el('button', { class: 'ghost', type: 'button', onclick: () => a.startBlind() }, COPY.lab.blind),
      ],
    },
    () => rows.set(s.rounds()),
  );
}

export function blind(s: Session, a: Actions): Screen {
  const sub = el('p', { class: 'sub', text: COPY.blind.sub(s.tapsLeft()) });
  const rows = strip();
  rows.set(s.rounds());
  return playable(
    s,
    a,
    {
      stage: [heading(COPY.blind.ask, 'sm'), sub, rows.node],
      controls: [el('button', { class: 'ghost', type: 'button', onclick: () => a.goto('verdict') }, COPY.blind.call)],
    },
    () => {
      rows.set(s.rounds());
      sub.textContent = COPY.blind.sub(Math.max(0, s.tapsLeft()));
    },
  );
}

export function verdict(s: Session, a: Actions): Screen {
  const sh = shell(s);
  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: [
        heading(COPY.blind.verdictAsk, 'sm'),
        el(
          'div',
          { class: 'cards' },
          ...(['friend', 'neutral', 'foe'] as Opponent[]).map((k) =>
            el(
              'button',
              { class: 'card', type: 'button', onclick: () => a.callIt(k) },
              k === 'neutral' ? 'Neither — it was random' : `The ${k}`,
            ),
          ),
        ),
      ],
      bottom: [],
    }),
  };
}

export function called(s: Session, a: Actions, pick: Opponent): Screen {
  const sh = shell(s);
  const right = pick === s.hidden;
  return {
    node: frame({
      label: sh.label,
      chip: sh.chip.node,
      stage: [
        heading(right ? COPY.blind.right : COPY.blind.wrong),
        el('p', { class: 'sub', html: `It was the <b>${s.hidden}</b>. ${COPY.tell[s.hidden]}` }),
        choiceStrip(s.blindRounds()),
      ],
      bottom: [
        el('button', { class: 'cta', type: 'button', onclick: () => a.startBlind() }, COPY.blind.again),
        el('button', { class: 'ghost', type: 'button', onclick: () => a.goto('lab') }, COPY.blind.back),
      ],
    }),
  };
}

function fmt(n: number): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}`;
}
