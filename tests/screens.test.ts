// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as screens from '../src/ui/screens';
import type { Actions, Screen } from '../src/ui/screens';
import { Session } from '../src/journey/session';
import { BEATS, type Phase } from '../src/journey/beats';
import { Run, type Choice } from '../src/engine';

/**
 * The layer every bug so far has lived in: refs wiped before use, refs left
 * pointing at a replaced screen, and a route out of the lab that silently
 * stopped existing. None of those were visible from the engine or the session.
 */

const noop = (): void => {};
const actions = (over: Partial<Actions> = {}): Actions => ({
  tap: noop, goto: noop, commit: noop, startBlind: noop, callIt: noop,
  setOpponent: noop, setAlpha: noop, toggleBelief: noop, ...over,
});

const BUILDERS: Record<Phase, (s: Session, a: Actions) => Screen> = {
  act1: screens.actOne, commit: screens.commit, act2: screens.actTwo, notice: screens.notice,
  reveal: screens.reveal, replay: screens.replay, act3: screens.actThree, debrief: screens.debrief,
  lab: screens.lab, blind: screens.blind, verdict: screens.verdict,
};

/** A session far enough along that any screen can be built from it. */
function played(phase: Phase): Session {
  const s = new Session(new Run(11));
  s.goto('act1');
  for (let i = 0; i < 12; i++) s.tap((i % 2) as Choice);
  s.goto('act2');
  for (let i = 0; i < 12; i++) s.tap((i % 3 ? 1 : 0) as Choice);
  s.goto('reveal');
  for (let i = 0; i < 8; i++) s.tap((i % 2) as Choice);
  s.goto('act3');
  for (let i = 0; i < 8; i++) s.tap(0);
  s.guess = 'me';
  s.goto(phase);
  if (phase === 'blind' || phase === 'verdict') s.blindMark = s.mark;
  return s;
}

beforeEach(() => localStorage.clear());

describe('every screen', () => {
  it('has exactly one heading, so a reader always lands somewhere', () => {
    for (const phase of Object.keys(BUILDERS) as Phase[]) {
      const node = BUILDERS[phase](played(phase), actions()).node;
      expect(node.querySelectorAll('h1'), phase).toHaveLength(1);
      expect(node.querySelector('h1')!.textContent!.trim(), phase).not.toBe('');
    }
  });

  it('names itself in the top bar', () => {
    for (const phase of Object.keys(BUILDERS) as Phase[]) {
      const node = BUILDERS[phase](played(phase), actions()).node;
      expect(node.querySelector('.top .label')!.textContent, phase).toContain(BEATS[phase].label);
    }
  });

  it('leaves no beat without a way out', () => {
    for (const phase of Object.keys(BUILDERS) as Phase[]) {
      const node = BUILDERS[phase](played(phase), actions()).node;
      const exits = node.querySelectorAll('button, input[type=range]').length;
      expect(exits, `${phase} would strand the player`).toBeGreaterThan(0);
    }
  });
});

describe('the lab', () => {
  it('offers a route into blind mode', () => {
    // This regressed once: three screens spliced a button into their own built
    // DOM and the lab was simply missing its splice.
    let started = 0;
    const node = screens.lab(played('lab'), actions({ startBlind: () => started++ })).node;
    const ghost = [...node.querySelectorAll('button.ghost')].find((b) => /blind/i.test(b.textContent!));
    expect(ghost).toBeDefined();
    (ghost as HTMLButtonElement).click();
    expect(started).toBe(1);
  });

  it('lets you switch opponent and hide the belief', () => {
    const seen: string[] = [];
    const node = screens.lab(
      played('lab'),
      actions({ setOpponent: (o) => seen.push(o), toggleBelief: () => seen.push('toggle') }),
    ).node;
    node.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.click());
    node.querySelector<HTMLButtonElement>('.switch button')!.click();
    expect(seen).toEqual(['friend', 'neutral', 'foe', 'toggle']);
  });
});

describe('the commitment gate', () => {
  it('will not let you through without an answer', () => {
    const committed: string[] = [];
    const node = screens.commit(played('commit'), actions({ commit: (id) => committed.push(id) })).node;
    const cta = node.querySelector<HTMLButtonElement>('button.cta')!;
    expect(cta.disabled).toBe(true);
    cta.click();
    expect(committed).toEqual([]);

    node.querySelectorAll<HTMLButtonElement>('.card')[0].click();
    expect(cta.disabled).toBe(false);
    cta.click();
    expect(committed).toEqual(['coin']);
  });

  it('never offers the answer as one of the options', () => {
    // Handing over "something reacting to me" as a tappable card told the
    // player the thing the whole game exists for them to discover.
    const text = [...screens.commit(played('commit'), actions()).node.querySelectorAll('.card')]
      .map((c) => c.textContent!.toLowerCase())
      .join(' | ');
    expect(text).not.toMatch(/react|respond|watch|me\b|my |predict|adapt/);
    expect(text).toContain('something else');
  });

  it('opens a blank line for an answer we did not offer, and needs words in it', () => {
    const committed: [string, string | undefined][] = [];
    const node = screens.commit(played('commit'), actions({ commit: (id, t) => committed.push([id, t]) })).node;
    const cta = node.querySelector<HTMLButtonElement>('button.cta')!;
    const own = node.querySelector<HTMLInputElement>('input.own')!;
    expect(own.hidden).toBe(true);

    const cards = node.querySelectorAll<HTMLButtonElement>('.card');
    cards[cards.length - 1].click();
    expect(own.hidden).toBe(false);
    expect(cta.disabled, 'a blank blank is not an answer').toBe(true);

    own.value = 'it puts it where I did not go last time';
    own.dispatchEvent(new Event('input'));
    expect(cta.disabled).toBe(false);
    cta.click();
    expect(committed).toEqual([['other', 'it puts it where I did not go last time']]);
  });

  it('hides the blank line again if they change their mind', () => {
    const node = screens.commit(played('commit'), actions()).node;
    const cards = node.querySelectorAll<HTMLButtonElement>('.card');
    const own = node.querySelector<HTMLInputElement>('input.own')!;
    cards[cards.length - 1].click();
    expect(own.hidden).toBe(false);
    cards[0].click();
    expect(own.hidden).toBe(true);
  });

  it('marks only the chosen answer', () => {
    const node = screens.commit(played('commit'), actions()).node;
    const cards = node.querySelectorAll<HTMLButtonElement>('.card');
    cards[1].click();
    cards[2].click();
    expect([...cards].map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true', 'false']);
  });
});

describe('the debrief', () => {
  it('gives back the player’s own words rather than grading them', () => {
    const s = played('debrief');
    s.guess = 'other';
    s.guessText = 'it goes wherever I am not looking';
    const card = screens.debrief(s, actions()).node.querySelector('.card')!;
    expect(card.textContent).toContain('it goes wherever I am not looking');
    expect(card.classList.contains('wrong'), 'their own words are not marked wrong').toBe(false);
  });

  it('does mark one of the three offered guesses, since all three are wrong', () => {
    const s = played('debrief');
    s.guess = 'sequence';
    const card = screens.debrief(s, actions()).node.querySelector('.card')!;
    expect(card.classList.contains('wrong')).toBe(true);
  });
});

describe('the boxes', () => {
  it('open to show both contents, then close again', () => {
    const s = played('reveal');
    const screen = screens.reveal(s, actions());
    const round = s.tap(0);
    screen.onRound!(round);

    const [left, right] = screen.node.querySelectorAll('.box');
    const winner = round.reward === 0 ? left : right;
    const loser = round.reward === 0 ? right : left;
    expect(winner.classList.contains('reward')).toBe(true);
    expect(loser.classList.contains('empty')).toBe(true);
    expect(winner.querySelector('.state')!.textContent).toBe('REWARD');
    expect(loser.querySelector('.state')!.textContent).toBe('EMPTY');

    screen.onClear!();
    expect(screen.node.querySelectorAll('.reward, .empty, .taken')).toHaveLength(0);
    expect(screen.node.querySelector('.state')!.textContent).toBe('');
  });

  it('reports the tap through to the app', () => {
    const taps: Choice[] = [];
    const node = screens.reveal(played('reveal'), actions({ tap: (c) => taps.push(c) })).node;
    node.querySelectorAll<HTMLButtonElement>('.box').forEach((b) => b.click());
    expect(taps).toEqual([0, 1]);
  });
});

describe('the belief bar', () => {
  it('says the number out loud, not just in pixels', () => {
    const s = played('reveal');
    const screen = screens.reveal(s, actions());
    screen.onRound!(s.tap(0));
    const bar = screen.node.querySelector('.bar')!;
    const name = bar.getAttribute('aria-label')!;
    expect(name).toMatch(/expects you to pick (left|right), \d+ percent/);
    // The visible readouts would otherwise be announced as "LEFT 62%38% RIGHT".
    expect(bar.querySelectorAll('[aria-hidden=true]')).toHaveLength(2);
  });

  it('moves with the tap that moved it', () => {
    const s = played('reveal');
    const screen = screens.reveal(s, actions());
    const before = (screen.node.querySelector('.bar > i') as HTMLElement).style.width;
    screen.onRound!(s.tap(1));
    const after = (screen.node.querySelector('.bar > i') as HTMLElement).style.width;
    expect(after).not.toBe(before);
    expect(screen.node.querySelector('.bar')!.classList.contains('moved')).toBe(true);
  });
});

describe('act one', () => {
  it('offers the skip only to someone who has played before', () => {
    expect(screens.actOne(new Session(new Run(1)), actions()).node.querySelector('button.ghost')).toBeNull();
    localStorage.setItem('fof.seen', '1');
    expect(screens.actOne(new Session(new Run(1)), actions()).node.querySelector('button.ghost')).not.toBeNull();
  });

  it('drops the opening line once the player has started', () => {
    const s = new Session(new Run(1));
    expect(screens.actOne(s, actions()).node.textContent).toContain('One of these boxes');
    s.tap(0);
    expect(screens.actOne(s, actions()).node.textContent).not.toContain('One of these boxes');
  });
});

describe('blind mode', () => {
  it('counts down the taps it has left', () => {
    const s = played('blind');
    const screen = screens.blind(s, actions());
    expect(screen.node.textContent).toContain(`${BEATS.blind.play!.taps} taps`);
    screen.onRound!(s.tap(0));
    expect(screen.node.textContent).toContain(`${BEATS.blind.play!.taps - 1} taps`);
  });

  it('never shows the belief', () => {
    expect(screens.blind(played('blind'), actions()).node.querySelector('.bar')).toBeNull();
  });
});

describe('the replay figure', () => {
  it('draws one cell per foe tap, aligned under the trace', () => {
    const s = played('replay');
    const node = screens.replay(s, actions()).node;
    const taps = s.run.history('foe').length;
    expect(node.querySelectorAll('.strip.aligned b')).toHaveLength(taps);
    expect(node.querySelector<HTMLInputElement>('input[type=range]')!.max).toBe(String(taps));
  });

  it('moves the marked cell with the scrubber', () => {
    const node = screens.replay(played('replay'), actions()).node;
    const scrub = node.querySelector<HTMLInputElement>('input[type=range]')!;
    scrub.value = '5';
    scrub.dispatchEvent(new Event('input'));
    const cells = [...node.querySelectorAll('.strip.aligned b')];
    expect(cells.findIndex((c) => c.classList.contains('now'))).toBe(4);
    expect(node.querySelector('.sub')!.textContent).toContain('Tap 5');
  });
});

describe('the 2017 original', () => {
  it('is reachable from the debrief and from the lab', () => {
    // The build ships legacy/ alongside dist/; these are the only two ways in,
    // and a refactor has already dropped a link out of the lab once.
    const href = (s: Session, build: (s: Session, a: Actions) => Screen) =>
      [...build(s, actions()).node.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(href(played('debrief'), screens.debrief)).toContain('legacy/');
    expect(href(played('lab'), screens.lab)).toContain('legacy/');
  });
});
