/**
 * The journey's state, with no DOM in it.
 *
 * Everything the player has done and where they are in the story lives here,
 * so a whole playthrough can be driven and asserted in a test, and so the
 * screens can be pure functions of it.
 */
import { OPPONENTS, Run, type Choice, type Opponent, type Round } from '../engine';
import { BEATS, type Beat, type Phase } from './beats';

export class Session {
  readonly run: Run;
  phase: Phase = 'act1';
  /** Where the current beat's rounds start in the transcript. */
  mark = 0;
  /** Which offered guess they tapped, or 'other' when they wrote their own. */
  guess: string | null = null;
  /** Their own words, when they wrote some. */
  guessText = '';
  /** The opponent blind mode is hiding, and where that round began. */
  hidden: Opponent = 'foe';
  blindMark = 0;
  lab = { opponent: 'foe' as Opponent, belief: true, alpha: 0.25 };

  constructor(run = new Run()) {
    this.run = run;
    this.lab.alpha = run.alpha;
  }

  get beat(): Beat {
    return BEATS[this.phase];
  }

  opponent(): Opponent {
    if (this.phase === 'lab') return this.lab.opponent;
    if (this.phase === 'blind') return this.hidden;
    return this.beat.play?.opponent ?? 'neutral';
  }

  showsBelief(): boolean {
    if (this.phase === 'lab') return this.lab.belief;
    if (this.phase === 'blind') return false;
    return this.beat.play?.belief ?? false;
  }

  /** Rounds played in the current beat. */
  rounds(): Round[] {
    return this.run.rounds.slice(this.mark);
  }

  /** The blind round's transcript, which outlives the beat that produced it. */
  blindRounds(): Round[] {
    return this.run.rounds.slice(this.blindMark);
  }

  /** Whatever this beat says the chip counts. */
  chipRounds(): Round[] {
    switch (this.beat.counts ?? 'beat') {
      case 'run': return this.run.rounds;
      case 'foeHistory': return this.run.history('foe');
      case 'blindRound': return this.blindRounds();
      case 'labOpponent': return this.run.history(this.lab.opponent);
      case 'beat': return this.rounds();
    }
  }

  /** The nudge this beat offers, if the player has earned it. */
  hint(): string | null {
    const hint = this.beat.hint;
    if (!hint || this.rounds().length !== hint.after) return null;
    const score = this.rounds().reduce((n, r) => n + (r.win ? 1 : -1), 0);
    return score < hint.scoreBelow ? hint.text : null;
  }

  tapsLeft(): number {
    return (this.beat.play?.taps ?? 0) - this.rounds().length;
  }

  beatComplete(): boolean {
    return Boolean(this.beat.play) && this.tapsLeft() <= 0;
  }

  tap(choice: Choice): Round {
    return this.run.step(this.opponent(), choice);
  }

  /** Only a playable beat starts a new count; interstitials keep the last one. */
  goto(phase: Phase): void {
    this.phase = phase;
    if (BEATS[phase].play) this.mark = this.run.rounds.length;
  }

  advance(): void {
    if (this.beat.next) this.goto(this.beat.next);
  }

  startBlind(pick = Math.random()): void {
    this.hidden = OPPONENTS[Math.floor(pick * OPPONENTS.length)];
    this.run.beliefs[this.hidden] = [0.5, 0.5];
    this.goto('blind');
    this.blindMark = this.mark;
  }

  setAlpha(alpha: number): void {
    this.lab.alpha = alpha;
    this.run.alpha = alpha;
  }

  setOpponent(opponent: Opponent): void {
    this.lab.opponent = opponent;
    this.mark = this.run.rounds.length;
  }
}
