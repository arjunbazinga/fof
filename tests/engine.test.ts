import { describe, it, expect } from 'vitest';
import {
  ALPHA_DEFAULT,
  CEILING,
  INITIAL_BELIEF,
  P_LEFT_NEUTRAL,
  Run,
  summarise,
  updateBelief,
  type Choice,
} from '../src/engine';

/** Play `taps` turns against one opponent, choosing with `policy`. */
function play(opponent: 'friend' | 'neutral' | 'foe', taps: number, policy: (run: Run) => Choice, seed = 7) {
  const run = new Run(seed);
  for (let i = 0; i < taps; i++) run.step(opponent, policy(run));
  return summarise(run.history(opponent));
}

describe('the smoother', () => {
  it('keeps the belief a probability distribution', () => {
    let b = INITIAL_BELIEF;
    for (const c of [0, 1, 1, 0, 1, 1, 1, 0] as Choice[]) {
      b = updateBelief(b, c, ALPHA_DEFAULT);
      expect(b[0] + b[1]).toBeCloseTo(1, 12);
    }
  });

  it('weights the last choice by alpha and the past by 1 - alpha', () => {
    expect(updateBelief([0.5, 0.5], 1, 0.25)).toEqual([0.375, 0.625]);
    expect(updateBelief([0.5, 0.5], 0, 0.25)).toEqual([0.625, 0.375]);
  });

  it('moves further on each tap as alpha rises', () => {
    const slow = updateBelief([0.5, 0.5], 1, 0.1)[1];
    const fast = updateBelief([0.5, 0.5], 1, 0.9)[1];
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('the friend rewards being predictable', () => {
  it('pays every turn if you pick one box and stick to it', () => {
    const s = play('friend', 40, () => 0);
    expect(s.average).toBe(1);
  });

  it('costs one turn to switch allegiance, then pays every turn', () => {
    const s = play('friend', 40, () => 1);
    expect(s.wins).toBe(39);
  });

  it('punishes perfect alternation on every single turn', () => {
    // The belief always lags one tap behind, so a cooperator is guaranteed to
    // guess wrong -- the worst play in the game is against the agent helping you.
    let next: Choice = 0; // the friend breaks the opening tie to box 0
    const s = play('friend', 40, () => {
      next = next === 0 ? 1 : 0;
      return next;
    });
    expect(s.average).toBe(-1);
  });
});

describe('the foe punishes being predictable', () => {
  it('takes everything from a player who sticks to one box', () => {
    const s = play('foe', 40, () => 0);
    expect(s.wins).toBe(1); // only the opening tie, which argmin breaks to box 0
  });

  it('is beaten every single turn by a player who tracks its belief', () => {
    // The foe is deterministic and its state is a known function of your own
    // history, so a model-based player never loses. This is the whole reason
    // the environment hides that state.
    const s = play('foe', 40, (run) => run.peek('foe'));
    expect(s.average).toBe(1);
    expect(s.average).toBe(CEILING.foe.modelled);
  });

  it('holds a uniform-random player to break-even, the minimax value', () => {
    const run = new Run(20250903);
    const coin = () => (Math.random() < 0.5 ? 0 : 1) as Choice;
    for (let i = 0; i < 20000; i++) run.step('foe', coin());
    expect(Math.abs(summarise(run.history('foe')).average)).toBeLessThan(0.05);
    expect(CEILING.foe.stationary).toBe(0);
  });
});

describe('the neutral room is an ordinary bandit', () => {
  it('pays 2p - 1 per tap to a player who always takes the better box', () => {
    const s = play('neutral', 20000, () => 0, 424242);
    expect(s.average).toBeCloseTo(2 * P_LEFT_NEUTRAL - 1, 1);
    expect(s.average).toBeCloseTo(CEILING.neutral.stationary, 1);
  });
});

describe('runs', () => {
  it('keeps one belief per opponent, so they cannot read each other', () => {
    const run = new Run(1);
    for (let i = 0; i < 10; i++) run.step('foe', 0);
    expect(run.beliefs.foe[0]).toBeGreaterThan(0.9);
    expect(run.beliefs.friend).toEqual(INITIAL_BELIEF);
    expect(run.beliefs.neutral).toEqual(INITIAL_BELIEF);
  });

  it('places the reward before it sees the tap it is predicting', () => {
    const run = new Run(1);
    const predicted = run.peek('foe');
    const round = run.step('foe', 1, predicted);
    expect(round.reward).toBe(predicted);
    expect(round.belief).toEqual(INITIAL_BELIEF);
  });

  it('replays identically from the same seed', () => {
    const script: Choice[] = [0, 1, 1, 0, 1, 0, 0, 1, 1, 1];
    const a = new Run(99);
    const b = new Run(99);
    for (const c of script) {
      a.step('neutral', c);
      b.step('neutral', c);
    }
    expect(a.history()).toEqual(b.history());
  });
});

describe('summaries', () => {
  it('measures how often the player switched boxes', () => {
    const run = new Run(5);
    for (const c of [0, 1, 0, 1, 0] as Choice[]) run.step('neutral', c);
    expect(summarise(run.history()).switchRate).toBe(1);

    const stuck = new Run(5);
    for (const c of [1, 1, 1, 1, 1] as Choice[]) stuck.step('neutral', c);
    expect(summarise(stuck.history()).switchRate).toBe(0);
  });
});
