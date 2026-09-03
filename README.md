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

Deployed to GitHub Pages by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
on push to `master`.

## `legacy/`

The original 2017 build, kept as it shipped: one `index.html`, a hand-maintained
`fof.min.js`, and 156 KB of Chart.js to draw a ±1 line.
