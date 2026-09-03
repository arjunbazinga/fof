/**
 * Wiring: it owns the tap timing, swaps screens, and does nothing else.
 *
 * The story lives in journey/beats.ts, the state in journey/session.ts, the
 * words in journey/copy.ts, and the pixels in ui/. This file only connects them.
 */
import { reducedMotion } from './ui/dom';
import { focusHeading } from './ui/instruments';
import * as screens from './ui/screens';
import type { Actions, Screen } from './ui/screens';
import { RESOLVE_MS, RESOLVE_MS_REDUCED, TAP_THROUGH_AFTER_MS, type Phase } from './journey/beats';
import { Session } from './journey/session';
import { summarise, type Choice, type Opponent } from './engine';

export class App {
  private root: HTMLElement;
  private session = new Session();
  private screen!: Screen;
  private live: HTMLElement;
  private locked = false;
  private lockedAt = 0;
  private pending = 0;
  private started = false;
  /** The blind-mode answer, which is a moment rather than a beat. */
  private called: Opponent | null = null;

  private actions: Actions = {
    tap: (choice) => this.tap(choice),
    goto: (phase) => this.goto(phase),
    commit: (id) => {
      this.session.guess = id;
      this.session.advance();
      this.render();
    },
    startBlind: () => {
      this.called = null;
      this.session.startBlind();
      this.render();
    },
    callIt: (pick) => {
      this.called = pick;
      this.render();
    },
    setOpponent: (opponent) => {
      this.session.setOpponent(opponent);
      this.render();
    },
    setAlpha: (alpha) => this.session.setAlpha(alpha),
    toggleBelief: () => {
      this.session.lab.belief = !this.session.lab.belief;
      this.render();
    },
  };

  constructor(root: HTMLElement) {
    this.root = root;
    this.live = document.createElement('div');
    this.live.className = 'sr';
    this.live.setAttribute('role', 'status');
    this.live.setAttribute('aria-live', 'polite');
    document.body.append(this.live);

    window.addEventListener('keydown', (e) => {
      if (!this.session.beat.play) return;
      if (e.key === 'ArrowLeft') this.tap(0);
      if (e.key === 'ArrowRight') this.tap(1);
    });

    this.render();
    this.started = true;
  }

  private goto(phase: Phase): void {
    this.called = null;
    this.session.goto(phase);
    this.render();
    window.scrollTo(0, 0);
  }

  private render(): void {
    this.screen = this.build();
    this.root.replaceChildren(this.screen.node);
    // Move the reader to the new beat, but never steal focus on first paint.
    if (this.started) focusHeading(this.screen.node);
  }

  private build(): Screen {
    const s = this.session;
    const a = this.actions;
    if (this.called) return screens.called(s, a, this.called);
    switch (s.phase) {
      case 'act1': return screens.actOne(s, a);
      case 'commit': return screens.commit(s, a);
      case 'act2': return screens.actTwo(s, a);
      case 'notice': return screens.notice(s, a);
      case 'reveal': return screens.reveal(s, a);
      case 'replay': return screens.replay(s, a);
      case 'act3': return screens.actThree(s, a);
      case 'debrief': return screens.debrief(s, a);
      case 'lab': return screens.lab(s, a);
      case 'blind': return screens.blind(s, a);
      case 'verdict': return screens.verdict(s, a);
    }
  }

  private tap(choice: Choice): void {
    // A second tap while the boxes are open skips ahead, but not so soon that
    // a fumbled double-tap swallows the result.
    if (this.locked) {
      if (performance.now() - this.lockedAt > TAP_THROUGH_AFTER_MS) this.resolve();
      return;
    }
    this.locked = true;
    this.lockedAt = performance.now();

    const round = this.session.tap(choice);
    this.screen.onRound?.(round);
    this.live.textContent = `${round.win ? 'Reward' : 'Empty'}. Score ${summarise(this.session.chipRounds()).score}.`;

    this.pending = window.setTimeout(
      () => this.resolve(),
      reducedMotion() ? RESOLVE_MS_REDUCED : RESOLVE_MS,
    );
  }

  private resolve(): void {
    window.clearTimeout(this.pending);
    this.locked = false;
    if (this.session.beatComplete() && this.session.beat.next) {
      this.session.advance();
      this.render();
      window.scrollTo(0, 0);
    } else {
      this.screen.onClear?.();
    }
  }
}
