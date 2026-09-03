/**
 * Every word the player reads, in one place.
 *
 * Kept out of the screen builders so the writing can be revised without
 * touching behaviour, and so the whole voice can be read end to end.
 */
import type { Opponent } from '../engine';

export const COPY = {
  open: {
    ask: 'One of these boxes has the reward.',
    sub: 'Pick one. That’s the whole game.',
    skip: 'Played before — skip to the lab',
  },
  actOne: {
    note: 'Green means you found it.',
  },
  commit: {
    ask: 'Before you go on — what’s deciding where the reward goes?',
    cta: 'Lock it in',
    sub: 'You’ll be scored on this at the end.',
  },
  actTwo: {
    caption: 'Your score, this round',
    note: 'Same two boxes.',
  },
  notice: {
    cta: 'Show me why',
    // Read from the transcript, because a player who alternates in phase
    // actually beats the foe and must not be told they were losing.
    lost: (n: number, of: number) => [`You lost ${n} of the last ${of}.`, 'Still a coin?'],
    won: (n: number, of: number) => [
      `You won ${n} of the last ${of}.`,
      'That wasn’t luck. You found its rule without meaning to.',
    ],
    mixed: (won: number, lost: number, of: number) => [
      `Your last ${of}: ${won} up, ${lost} down.`,
      'Whatever that was, it wasn’t a coin.',
    ],
  },
  reveal: {
    ask: 'This bar has been here since your first tap.',
    note: 'You just couldn’t see it. Watch what your next tap does to it.',
    hint: 'It hides the reward where you’re least likely to go.',
    caption: 'It expects you to pick',
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
    guessLabel: 'You guessed',
    ceilingLabel: 'Yours vs. the best a memoryless player can do',
    lab: 'Open the lab',
    blind: 'Blind mode — name the room from behaviour alone',
    credit: 'First built in 2017 by <a href="https://twitter.com/arjunsriv">@arjunsriv</a>.',
    rule: 'All three rooms ran one rule: a smoothed estimate of your next tap. The only input was you.',
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
  guesses: [
    { id: 'coin', text: 'A fair coin', right: false },
    { id: 'biased', text: 'A coin, but biased', right: false },
    { id: 'pattern', text: 'A fixed pattern I could learn', right: false },
    { id: 'me', text: 'Something reacting to me', right: true },
  ],
  room: { friend: 'Green room', neutral: 'White room', foe: 'Red room' } as Record<Opponent, string>,
  tell: {
    friend: 'It rewards whatever you do twice in a row.',
    neutral: 'It never looked at you at all — the left box just wins 60% of the time.',
    foe: 'It puts the reward wherever your recent taps say you’re least likely to go.',
  } as Record<Opponent, string>,
} as const;
