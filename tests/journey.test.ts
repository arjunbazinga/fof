import { describe, it, expect } from 'vitest';
import { BEATS, JOURNEY, RESOLVE_MS, TAP_THROUGH_AFTER_MS, type Phase } from '../src/journey/beats';
import { COPY } from '../src/journey/copy';

describe('the journey table', () => {
  it('only points at beats that exist', () => {
    for (const [name, beat] of Object.entries(BEATS)) {
      if (beat.next) expect(BEATS[beat.next], `${name} -> ${beat.next}`).toBeDefined();
    }
  });

  it('runs act1 through debrief without a break in the chain', () => {
    let at: Phase = 'act1';
    const walked: Phase[] = [at];
    while (BEATS[at].next && walked.length < 20) {
      at = BEATS[at].next!;
      walked.push(at);
    }
    expect(walked).toEqual(JOURNEY);
  });

  it('ends the guided run at the debrief', () => {
    expect(BEATS.debrief.next).toBeUndefined();
    expect(JOURNEY[JOURNEY.length - 1]).toBe('debrief');
  });

  it('gives every playable beat a tap budget and a way out', () => {
    for (const [name, beat] of Object.entries(BEATS)) {
      if (!beat.play) continue;
      expect(beat.play.taps, name).toBeGreaterThan(0);
      expect(beat.next, `${name} would trap the player`).toBeDefined();
    }
  });

  it('reveals the belief only after the player has committed a guess', () => {
    const firstShown = JOURNEY.find((p) => BEATS[p].play?.belief);
    expect(JOURNEY.indexOf(firstShown!)).toBeGreaterThan(JOURNEY.indexOf('commit'));
  });

  it('keeps the guided run short enough to finish on a phone', () => {
    const taps = JOURNEY.reduce((n, p) => n + (BEATS[p].play?.taps ?? 0), 0);
    expect(taps).toBeLessThanOrEqual(40);
    expect(taps).toBeGreaterThanOrEqual(24);
  });

  it('lets a second tap skip ahead, but not a fumbled double-tap', () => {
    expect(TAP_THROUGH_AFTER_MS).toBeGreaterThan(150);
    expect(TAP_THROUGH_AFTER_MS).toBeLessThan(RESOLVE_MS);
  });
});

describe('what a beat declares about itself', () => {
  it('gives every hint something to say and a moment to say it', () => {
    for (const [name, beat] of Object.entries(BEATS)) {
      if (!beat.hint) continue;
      expect(beat.hint.text, name).toBeTruthy();
      expect(beat.hint.after, name).toBeGreaterThan(0);
      expect(beat.hint.after, `${name} would nudge after the beat has ended`).toBeLessThan(
        beat.play?.taps ?? 0,
      );
    }
  });

  it('only counts something other than its own rounds where that is the point', () => {
    const special = Object.entries(BEATS).filter(([, b]) => b.counts);
    expect(Object.fromEntries(special.map(([k, b]) => [k, b.counts]))).toEqual({
      replay: 'foeHistory',
      debrief: 'run',
      lab: 'labOpponent',
      verdict: 'blindRound',
    });
  });
});

describe('what the player is told before they discover it', () => {
  it('states the premise without naming the mechanism', () => {
    const upfront = [COPY.open.ask, COPY.open.sub, COPY.commit.ask, ...COPY.guesses.map((g) => g.text)]
      .join(' ')
      .toLowerCase();
    // "Fixed" is true and is the whole trap: a rule can be fixed and still not
    // be independent of what you do. Saying so outright ends the game.
    expect(upfront).toContain('fixed rule');
    expect(upfront).not.toMatch(/react|respond|predict|adapt|watch(ing|es)?\b|reads? you/);
  });

  it('does not conclude on the player’s behalf at the turn', () => {
    const interstitial = [...COPY.notice.lost(8, 12), ...COPY.notice.won(11, 12), ...COPY.notice.mixed(6, 6)]
      .join(' ')
      .toLowerCase();
    expect(interstitial).not.toMatch(/wasn’t a coin|still a coin|found its rule|luck/);
  });
});
