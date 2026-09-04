/** The one thing the app remembers between visits. */
const SEEN = 'fof.seen';

/** Has this browser finished the guided run before? */
export function hasPlayed(): boolean {
  try {
    return localStorage.getItem(SEEN) !== null;
  } catch {
    return false; // private mode, blocked cookies: just show the journey
  }
}

export function rememberPlayed(): void {
  try {
    localStorage.setItem(SEEN, '1');
  } catch {
    // Nothing to do -- a returning player simply sees the journey again.
  }
}
