import { describe, it, expect } from 'vitest';
import { BEATS, JOURNEY, RESOLVE_MS, TAP_THROUGH_AFTER_MS, type Phase } from '../src/journey';

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
