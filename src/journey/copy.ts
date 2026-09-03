/**
 * Every word the player reads, in one place.
 *
 * Kept out of the screen builders so the writing can be revised without
 * touching behaviour, and so the whole voice can be read end to end.
 */
import type { Opponent } from '../engine';

export const COPY = {
  /** The belief bar wherever it appears -- three screens show the same one. */
  beliefCaption: 'It expects you to pick',

  open: {
    ask: 'One of these boxes has the reward.',
    // The premise is true and the ambiguity in it is the game: a rule can be
    // fixed and still not be independent of what you do. Nobody is told which
    // kind this is -- that is the thing to discover.
    sub: 'Each round it follows a fixed rule. Work it out and score as high as you can.',
    skip: 'Played before — skip to the lab',
  },
  actOne: {
    note: 'Green means you found it.',
  },
  commit: {
    ask: 'Before you go on — what’s the rule?',
    cta: 'Lock it in',
    sub: 'You’ll see this again at the end.',
    /** Chosen when none of the offered guesses fits. Opens a blank line. */
    otherLabel: 'Something else',
    otherPlaceholder: 'In your own words',
  },
  actTwo: {
    caption: 'Your score, this round',
    note: 'Same two boxes.',
  },
  notice: {
    cta: 'Show me round two’s rule',
    // Read from the transcript, because a player who alternates in phase
    // actually beats the foe and must not be told they were losing.
    // Report the round. Do not draw the conclusion for them -- naming what it
    // was not is most of the way to naming what it was.
    lost: (n: number, of: number) => [`You lost ${n} of the last ${of}.`, 'Round two is over.'],
    won: (n: number, of: number) => [`You won ${n} of the last ${of}.`, 'Round two is over.'],
    mixed: (won: number, lost: number) => [
      `Round two: ${won} up, ${lost} down.`,
      'That was a different rule from round one.',
    ],
  },
  reveal: {
    ask: 'This bar has been here since your first tap.',
    note: 'You just couldn’t see it. Watch what your next tap does to it.',
    hint: 'It hides the reward where you’re least likely to go.',
  },
  replay: {
    ask: 'It was reading you the whole time.',
    cta: 'One more room',
    beliefLabel: 'What it believed',
    choiceLabel: 'What you did',
    at: (tap: number, side: string, pct: number, went: string) =>
      `Tap ${tap}: it expected <b>${side}</b> at ${pct}% — you went <b>${went}</b>.`,
  },
  actThree: {
    ask: 'New room. This one wants you to win.',
    note: 'Same bar, same rule, opposite intent.',
    hint: 'You got good at being unreadable. This one needs to read you.',
  },
  debrief: {
    switchLabel: 'Your switch rate',
    guessLabel: 'Your answer, before round two',
    ceilingLabel: 'Yours vs. the best a memoryless player can do',
    lab: 'Open the lab',
    blind: 'Blind mode — name the room from behaviour alone',
    credit: 'First built in 2017 by <a href="https://twitter.com/arjunsriv">@arjunsriv</a>.',
    rule: 'Every round ran the same kind of rule, and it was fixed — it just was not fixed in the way the word suggests. Each one placed the reward from a smoothed estimate of your next tap. The only thing it read was you.',
    switched: (rate: number, pct: number) =>
      rate > 0.58
        ? `A fair coin switches half the time. You switched ${pct}% — the over-alternating the red room feeds on.`
        : rate < 0.42
          ? `A fair coin switches half the time. You switched ${pct}% — you settle, which the green room pays for and the red room punishes.`
          : `A fair coin switches half the time. You switched ${pct}%, which is close. Being hard to read is rarer than it sounds.`,
    paper: [
      'This is the <b>friend or foe</b> environment from <a href="https://arxiv.org/abs/1711.09883">AI Safety Gridworlds</a> (Leike et al., 2017), §2.2.3. The friend hides the reward where you’re most likely to look, the foe where you’re least likely, and the white room never looks at you at all.',
      'The paper calls it the suite’s only partially observable environment, “since the environment’s memory is not observed by the agent.” That memory is the bar. Hidden, the best you can do against the red room is break even by being unreadable. Shown, the foe is deterministic and you can win every round — which is the part worth keeping: an adversary is only unbeatable to someone who refuses to model it.',
      'When DeepMind ran this, Rainbow solved the red room by walking into a wall until random exploration knocked it sideways, then collapsed once that randomness was annealed away.',
    ],
  },
  lab: {
    beliefLabel: 'Its belief',
    hidden: 'Belief hidden — the environment as the paper defines it.',
    memory: 'Memory — low remembers everything, high only your last tap',
    blind: 'Blind mode',
  },
  blind: {
    ask: 'Friend, foe, or neither?',
    sub: (left: number) => `No colour, no bar. ${left} taps to work out who you’re playing.`,
    call: 'Call it now',
    verdictAsk: 'Which one were you playing?',
    right: 'Called it.',
    wrong: 'Not that one.',
    again: 'Again',
    back: 'Back to the lab',
  },
  /**
   * Three hypotheses a player actually forms, all of them wrong, and a blank.
   * Offering "something reacting to me" as a fourth option handed over the
   * whole game before they had played a single round of round two.
   */
  guesses: [
    { id: 'coin', text: 'A coin flip, fifty-fifty' },
    { id: 'biased', text: 'A coin, but it favours one box' },
    { id: 'sequence', text: 'A sequence that repeats' },
  ],
  room: { friend: 'Green room', neutral: 'White room', foe: 'Red room' } as Record<Opponent, string>,
  tell: {
    friend: 'It rewards whatever you do twice in a row.',
    neutral: 'It never looked at you at all — the left box just wins 60% of the time.',
    foe: 'It puts the reward wherever your recent taps say you’re least likely to go.',
  } as Record<Opponent, string>,
} as const;
