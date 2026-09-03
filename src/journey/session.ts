/**
 * The journey's state, with no DOM in it.
 *
 * Everything the player has done and where they are in the story lives here,
 * so a whole playthrough can be driven and asserted in a test, and so the
 * screens can be pure functions of it.
 */
import { Run, type Choice, type Opponent, type Round } from '../engine';
import { BEATS, type Beat, type Phase } from './beats';

export class Session {
  readonly run: Run;
  phase: Phase = 'act1';
  /** Where the current beat's rounds start in the transcript. */
  mark = 0;
  guess: string | null = null;
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

  /**
   * What the score chip counts. An interstitial reports the round the player
   * just finished -- otherwise "You lost 8 of the last 12" can sit beside a
   * cheerful running total and undercut its own headline.
   */
  chipRounds(): Round[] {
    if (this.phase === 'lab') return this.run.history(this.lab.opponent);
    if (this.phase === 'verdict') return this.blindRounds();
    // The replay screen draws every foe tap, so the chip counts them too.
    if (this.phase === 'replay') return this.run.history('foe');
    if (this.phase === 'debrief') return this.run.rounds;
    return this.rounds();
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
    const pool: Opponent[] = ['friend', 'neutral', 'foe'];
    this.hidden = pool[Math.floor(pick * pool.length)];
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
