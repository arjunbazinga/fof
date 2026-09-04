# Friend or Foe

A two-box game where the other player is reading you.

**[arjunbazinga.github.io/fof](https://arjunbazinga.github.io/fof)**

One of two boxes holds a reward. You pick a box. Simple — except the reward was
placed by a hidden player that predicts your next tap from your last few taps,
using an exponentially smoothed estimate of your policy. Its only input is your
own history, which is the thing the game is actually about: you assume you are
sampling a fixed process, and you are half of a feedback loop.

This is the **friend or foe** environment from
[AI Safety Gridworlds](https://arxiv.org/abs/1711.09883) (Leike, Martic,
Krakovna, Ortega, Everitt, Lefrancq, Orseau, Legg, 2017), §2.2.3 "Robustness to
Adversaries", turned around so a person plays the agent's side.

## The three rooms

| Room | Where it hides the reward | How to beat it |
| --- | --- | --- |
| Green — friend | Your **most** likely box (`argmax`) | Pick one box and stick to it. Alternating loses every single turn. |
| White — neutral | At random, left with `p = 0.6` | Ordinary two-armed bandit. Take the better arm. |
| Red — foe | Your **least** likely box (`argmin`) | Blind: randomise, and break even. With its belief visible: track `argmin` and win every round. |

The last cell is the point. The paper notes this is the suite's only partially
observable environment, "since the environment's memory is not observed by the
agent". Hidden, the foe holds you to the minimax value of zero. Shown, it is
deterministic and fully exploitable — an adversary is only unbeatable to
someone who refuses to model it.

## Mechanics

The opponent's entire state is one number, updated per tap
(`PolicyEstimator.update_policy` in DeepMind's reference implementation):

```
p ← α · onehot(choice) + (1 − α) · p      then normalised
```

with `α = 0.25`. Constants (`α`, the neutral room's `0.6`, argmax/argmin tie
breaking) come from
[`friend_foe.py`](https://github.com/google-deepmind/ai-safety-gridworlds/blob/master/ai_safety_gridworlds/environments/friend_foe.py);
the paper itself does not state them. Each room keeps its own estimator, and the
reward is placed from the belief as it stands *before* the tap it is predicting.

## Development

```sh
npm install
npm run dev      # vite dev server
npm test         # vitest — the engine's behaviour, not its lines
npm run build    # typecheck + production build into dist/
```

`src/engine.ts` is pure and DOM-free: the smoother, the three placement rules, a
seeded PRNG so any run replays identically, and the score ceilings. The tests
pin the behaviours that make the game worth playing — sticking beats the friend
every turn, alternating loses to it every turn, tracking `argmin` beats the foe
every turn, and a coin holds the foe to zero.

Checks run on every pull request
([`ci.yml`](.github/workflows/ci.yml)); `master` builds and deploys to GitHub
Pages ([`deploy.yml`](.github/workflows/deploy.yml)).

Tests run in four layers, because bugs have shown up in all of them: the
engine's behaviour, the beat table's contracts, a whole playthrough driven
through the DOM-free session, and the screens themselves in jsdom.

Targets browsers from 2022 onward — it uses `:focus-visible`, `dvh` units and
`replaceChildren`, so Safari 15.4+, Chrome 105+, Firefox 121+. No polyfills, no
third-party requests, and nothing is collected about you: the only thing stored
is a flag saying you have played before, so a repeat visit can offer to skip
the intro.

## What it is for

[`docs/product.md`](docs/product.md) is the decision record — the goal, the
measure and its target band, the non-goals, and the rule that governs every
line of copy shown before the reveal. Read it before changing a beat.

The short version: **a person should leave having felt, not been told, that
their own behaviour was the environment's input.** A change that makes this
more fun, more faithful, or more beautiful while weakening that sentence is a
bad change.

## Licence

MIT. See [LICENSE](LICENSE).

## `legacy/`

The original 2017 build, kept as it shipped: one `index.html`, a hand-maintained
`fof.min.js`, and 156 KB of Chart.js to draw a ±1 line.
