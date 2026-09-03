/**
 * One table for the whole journey.
 *
 * A beat says what the player does, what the chip counts, what nudge is
 * available, and where it goes next. Anything a beat needs to describe itself
 * belongs here rather than as a special case somewhere downstream.
 */
import type { Opponent } from '../engine';
import { COPY } from './copy';

export type Phase =
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

/**
 * What the score chip counts. An interstitial reports the round the player
 * just finished -- otherwise "You lost 8 of the last 12" can sit beside a
 * cheerful running total and undercut its own headline.
 */
export type Counts = 'beat' | 'run' | 'foeHistory' | 'blindRound' | 'labOpponent';

export interface Beat {
  /** Shown top-left. */
  label: string;
  /** Set on beats the player taps through; absent on interstitials. */
  play?: { opponent: Opponent; taps: number; belief: boolean };
  /** Where the beat goes when its taps run out, or its button is pressed. */
  next?: Phase;
  /** Defaults to the beat's own rounds. */
  counts?: Counts;
  /** One nudge, and only for a player who is stuck with the answer in view. */
  hint?: { after: number; scoreBelow: number; text: string };
  /** Content-heavy beats start at the top rather than centring. */
  flush?: boolean;
  /** Beats that count toward the journey's progress indicator. */
  act?: 1 | 2 | 3;
}

export const BEATS: Record<Phase, Beat> = {
  // Act one. The neutral bandit really is stationary, so the wrong model the
  // player builds here is honestly earned.
  act1: { label: 'Round one', play: { opponent: 'neutral', taps: 12, belief: false }, next: 'commit', act: 1 },
  commit: { label: 'Hold on', next: 'act2', act: 1 },

  // Act two. The foe, swapped in with no announcement.
  act2: { label: 'Round two', play: { opponent: 'foe', taps: 12, belief: false }, next: 'notice', act: 2 },
  notice: { label: 'Something changed', next: 'reveal', act: 2 },
  reveal: {
    label: 'Its head',
    play: { opponent: 'foe', taps: 8, belief: true },
    next: 'replay',
    hint: { after: 4, scoreBelow: 0, text: COPY.reveal.hint },
    act: 2,
  },
  replay: { label: 'Replay', next: 'act3', counts: 'foeHistory', act: 2 },

  // Act three. Unpredictability, just learned, is now exactly wrong.
  act3: {
    label: 'Round three',
    play: { opponent: 'friend', taps: 8, belief: true },
    next: 'debrief',
    hint: { after: 4, scoreBelow: 2, text: COPY.actThree.hint },
    act: 3,
  },
  debrief: { label: 'Debrief', counts: 'run', flush: true, act: 3 },

  // Past the credits.
  lab: { label: 'Lab', counts: 'labOpponent', flush: true },
  blind: { label: 'Blind', play: { opponent: 'foe', taps: 12, belief: false }, next: 'verdict' },
  verdict: { label: 'Blind', counts: 'blindRound' },
};

/** The beats a first-time player walks through, in order. */
export const JOURNEY: Phase[] = ['act1', 'commit', 'act2', 'notice', 'reveal', 'replay', 'act3', 'debrief'];

/** How long the opened boxes stay up before the next turn. */
export const RESOLVE_MS = 620;
export const RESOLVE_MS_REDUCED = 320;
/** Tapping again resolves early, but not so early that a double-tap skips it. */
export const TAP_THROUGH_AFTER_MS = 240;
