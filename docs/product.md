# What this is for

A decision record. Short on purpose: the reasoning lives in the playbook, this
is what it settled on, so a future change can be checked against it.

## Goal

**A person should come away knowing how little an agent is given to work with —
by being given exactly that much themselves, and noticing how fast, or how
slowly, they learn from it.**

The environments in *AI Safety Gridworlds* are small enough and short enough
that a person can simply be the agent for two minutes. That is rare. Most RL is
inaccessible to intuition because the environments are too large or too slow to
inhabit. These are not.

What the agent gets here, and therefore what the player gets: which room, two
boxes, one number per turn. No language, no explanation, and no sight of the
environment's memory — the paper's own footnote calls this the suite's only
partially observable environment, "since the environment's memory is not
observed by the agent".

**The friend-or-foe feedback loop is an instance, not the point.** That your own
history is the environment's input is what happens to be hard to learn in *this*
room. The general lesson is the poverty of what you are given and what it takes
to learn anything from it.

### Secondary goal

Produce a **human reference** for how quickly people solve these environments.
The paper has learning curves for A2C and Rainbow and none for a person. If
enough people play, this becomes the missing row in that table — and the start
of a human baseline across the suite.

Secondary means secondary. It is not worth degrading the first goal for.

## The measure

**Episodes to competence, per room.** The number of taps before a player's
trailing average crosses the room's threshold. That is a learning curve, it is
the same quantity the paper plots for its agents, and it is what "see how
quickly they learn" means in numbers.

Thresholds, from the ceilings the engine already computes:

| Room | Competent at | Why |
| --- | --- | --- |
| White (neutral) | trailing-8 average ≥ +0.1 | Found the better arm at `p = 0.6`. |
| Green (friend) | trailing-8 average ≥ +0.75 | Stuck to one box. |
| Red (foe) | trailing-8 average ≥ 0.0 | Stopped being read. Zero is the ceiling without the belief; above it means they are modelling it. |

**Discovery rate** — the share who name the mechanism in their own words before
the reveal — is demoted to what it actually is: a **check that the copy has not
leaked**, in a band of roughly 15–35%. Below, nobody is forming a model; above,
something is handing the answer over, which has happened once already and is now
guarded by tests.

### The comparison this exists to make

Verified against the paper and `friend_foe.py`, so it can be shown to a player:

- A2C and Rainbow were trained **1,000,000 steps per room**, separately. The
  optimal path from spawn to a box is **4 moves**, so that is roughly **250,000
  episodes** of practice, per room.
- A person's guided run is **40 episodes total** — 12 white, 20 red, 8 green.
- In the green room that is about **31,000× fewer episodes** for the human.

And it cuts the other way, which is the more interesting half: Rainbow solved
the red room by learning to bump into a wall until ε-greedy knocked it sideways,
then collapsed once ε annealed. A2C found a genuinely stochastic policy and
nearly solved all three rooms. **Almost no human plays the red room as well as
A2C does**, because deliberate randomisation is something people are bad at and
a policy gradient is good at.

So the calibration runs both directions: people are astonishingly sample
efficient and cannot randomise; the agents need six orders of magnitude more
experience and then beat us at the one thing we cannot do.

**Honesty constraint:** we do not have the paper's curve data, only its figures.
Never draw A2C's or Rainbow's learning curve. Show the published training
budget, the published outcome per room, and the player's own curve. Compare
budgets, not convergence points.

## Non-goals

- **Not a faithful port.** No grid, no movement, ±1 instead of `+50 / −1`.
  Divergences are named in the README. Fidelity serves the goal; it is not it.
- **Not an RL tutorial.** No jargon before the debrief.
- **Not a benchmark for agents.** The human baseline is the output; agents are
  not evaluated here.
- **Not fun-first.** It is an argument with a game's shape.

## The rule that governs the copy

The premise is true and its ambiguity is the game: **a rule can be fixed and
still not be independent of what you do.** Most people hear "fixed" as
"invariant to me" — which is exactly the assumption a model-free agent makes
about its environment.

Nothing before the reveal may name the mechanism: not directly, not as an
option, not by negation. The player is held in the agent's epistemic position —
an action, a reward, no vocabulary — and the vocabulary is the reward for
finishing.

## Positioning

> A two-box game where the other player is reading you.

The finding that travels: **the adversary is deterministic, and once you can see
its state it is fully exploitable — it only ever beat agents that refused to
model it.**

## Shape

Build the **toy**. Position it as the **paper's playable companion**. The
**format** — a human in the agent's seat across the other seven gridworlds,
each producing a human baseline — is now the coherent ambition rather than a
loose idea, but instance one still has to earn it.

## Analytics

Explicit opt-in at the debrief, nothing before it. An app about being profiled
from your behaviour does not get to quietly profile you from your behaviour.
Accepted cost: a much smaller sample, and one outbound request where there are
currently none. Without it the secondary goal does not exist at all.

## Order of work

1. **Learning curve in the debrief** — the player's episodes-to-competence per
   room, against the agents' published training budget. This is the goal made
   visible, and it is currently absent.
2. **Replay and share URL** — the engine has been seeded and deterministic since
   the rewrite and nothing exposes it. Launch blocker.
3. **Opt-in submission**, without which the secondary goal is impossible.
4. **Real-device Safari pass.** Never run on iOS, which is the primary target.
5. **Write up the finding.**
