import { describe, it, expect } from 'vitest';
import { Session } from '../src/journey/session';
import { BEATS, JOURNEY } from '../src/journey/beats';
import { Run, summarise, type Choice } from '../src/engine';

/** What the app does with a session: tap out a beat, then move on. */
function playBeat(s: Session, pick: (i: number) => Choice = () => 0): void {
  let i = 0;
  while (!s.beatComplete()) s.tap(pick(i++));
  s.advance();
}

describe('a session', () => {
  it('walks the guided run in order and stops at the debrief', () => {
    const s = new Session(new Run(4));
    const seen = [s.phase];
    while (s.beat.next) {
      if (s.beat.play) playBeat(s);
      else s.advance();
      seen.push(s.phase);
    }
    expect(seen).toEqual(JOURNEY);
    expect(s.phase).toBe('debrief');
  });

  it('reports the round just played on an interstitial, not the whole run', () => {
    // "You lost 8 of the last 12" must not sit next to a cheerful running
    // total from a round that went well.
    const s = new Session(new Run(4));
    playBeat(s); // act one
    s.advance(); // commit -> act two
    const beforeActTwo = s.run.rounds.length;
    playBeat(s, (i) => (i % 2) as Choice); // act two -> notice
    expect(s.phase).toBe('notice');
    expect(s.chipRounds()).toEqual(s.run.rounds.slice(beforeActTwo));
    expect(s.chipRounds().length).toBe(BEATS.act2.play!.taps);
  });

  it('keeps a beat count that only a playable beat resets', () => {
    const s = new Session(new Run(4));
    playBeat(s);
    const mark = s.mark;
    expect(s.phase).toBe('commit');
    expect(s.mark).toBe(mark); // commit is an interstitial
    s.advance();
    expect(s.mark).toBe(s.run.rounds.length); // act two starts a new count
  });

  it('remembers the blind round after the beat that produced it has ended', () => {
    const s = new Session(new Run(4));
    s.startBlind(0.9); // the foe
    expect(s.hidden).toBe('foe');
    for (let i = 0; i < 5; i++) s.tap(0);
    s.goto('verdict');
    expect(s.blindRounds()).toHaveLength(5);
    expect(s.chipRounds()).toHaveLength(5);
  });

  it('gives blind mode a fresh belief so the lab cannot leak into it', () => {
    const s = new Session(new Run(4));
    s.goto('lab'); // the lab's opponent only applies inside the lab
    s.setOpponent('foe');
    for (let i = 0; i < 12; i++) s.tap(0);
    expect(s.run.beliefs.foe[0]).toBeGreaterThan(0.9);
    s.startBlind(0.9);
    expect(s.run.beliefs.foe).toEqual([0.5, 0.5]);
  });

  it('scores the lab against the opponent on show, not the beat', () => {
    const s = new Session(new Run(4));
    s.goto('lab');
    s.setOpponent('friend');
    for (let i = 0; i < 6; i++) s.tap(0);
    expect(summarise(s.chipRounds()).taps).toBe(6);
    s.setOpponent('neutral');
    expect(summarise(s.chipRounds()).taps).toBe(0);
  });
});

describe('the nudge', () => {
  it('arrives on the beat’s chosen tap, and only for a player who is losing', () => {
    const s = new Session(new Run(4));
    s.goto('reveal');
    const hint = BEATS.reveal.hint!;
    for (let i = 0; i < hint.after - 1; i++) {
      s.tap(0);
      expect(s.hint()).toBeNull();
    }
    s.tap(0); // sticking against the foe loses, so the nudge is due
    expect(s.hint()).toBe(hint.text);
    s.tap(0);
    expect(s.hint(), 'it should not repeat').toBeNull();
  });

  it('stays quiet for a player who has already worked it out', () => {
    const s = new Session(new Run(4));
    s.goto('reveal');
    // Tracking the foe's argmin wins every round, so there is nothing to say.
    for (let i = 0; i < BEATS.reveal.hint!.after; i++) s.tap(s.run.peek('foe'));
    expect(s.hint()).toBeNull();
  });
});
