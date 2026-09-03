/**
 * One table for the whole journey.
 *
 * Previously a phase's opponent and tap count lived in one map and its
 * successor in another, inside `advance()`. Splitting a beat's definition
 * across two places is how a journey drifts out of sync with itself.
 */
import type { Opponent } from './engine';

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

export interface Beat {
  /** Shown top-left. */
  label: string;
  /** Set on beats the player taps through; absent on interstitials. */
  play?: { opponent: Opponent; taps: number; belief: boolean };
  /** Where the beat goes when its taps run out, or its button is pressed. */
  next?: Phase;
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
  reveal: { label: 'Its head', play: { opponent: 'foe', taps: 8, belief: true }, next: 'replay', act: 2 },
  replay: { label: 'Replay', next: 'act3', flush: true, act: 2 },

  // Act three. Unpredictability, just learned, is now exactly wrong.
  act3: { label: 'Green room', play: { opponent: 'friend', taps: 8, belief: true }, next: 'debrief', act: 3 },
  debrief: { label: 'Debrief', flush: true, act: 3 },

  // Past the credits.
  lab: { label: 'Lab', flush: true },
  blind: { label: 'Blind', play: { opponent: 'foe', taps: 12, belief: false }, next: 'verdict' },
  verdict: { label: 'Blind' },
};

/** The beats a first-time player walks through, in order. */
export const JOURNEY: Phase[] = ['act1', 'commit', 'act2', 'notice', 'reveal', 'replay', 'act3', 'debrief'];

/** How long the opened boxes stay up before the next turn. */
export const RESOLVE_MS = 620;
export const RESOLVE_MS_REDUCED = 320;
/** Tapping again resolves early, but not so early that a double-tap skips it. */
export const TAP_THROUGH_AFTER_MS = 240;
