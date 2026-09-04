# What this is for

A decision record. Short on purpose: the reasoning lives in the strategy memo,
this is what the reasoning settled on, so a future change can be checked
against it.

## Goal

**A person should leave having felt — not been told — that their own behaviour
was the environment's input.**

Everything else is subordinate. A change that makes the game more fun, more
faithful, or more beautiful while weakening that sentence is a bad change.

## The measure

**Discovery rate** — the share of players who describe the mechanism in their
own words on the commitment screen, before the reveal.

It is a **target band, not a number to maximise**: roughly **15–35%**.

- Below ~15%, nobody is forming a model. The rounds are too short, or the
  signal is too faint, and the reveal lands as an arbitrary assertion.
- Above ~35%, we are leaking. Some piece of copy, ordering or option is
  handing the answer over, and the discovery is not the player's.

That second failure has already happened once: "Something reacting to me" was
offered as a tappable option before round two. Two tests now guard against its
return (`tests/journey.test.ts`, "what the player is told before they discover
it").

Supporting measures, in order of usefulness:

1. **Completion** to the debrief — does the pacing hold on a phone.
2. **Exploit rate** — share of players who reach a positive average in the last
   four taps of the reveal beat, i.e. who used the belief bar once they had it.
3. **Reversal** — average against the friend in round three. Do they adapt, or
   carry the unpredictability forward.
4. **Switch rate** distribution — the human-randomness result, and the most
   shareable thing the game produces.

## Non-goals

- **Not a faithful port.** No grid, no movement, ±1 instead of +50/−1. The
  divergences are named in the README. Fidelity serves the goal; it is not the
  goal.
- **Not an RL tutorial.** No jargon before the debrief. Friend, foe, fictitious
  play and partial observability are the reward for finishing.
- **Not a benchmark.** Nothing here is for evaluating agents.
- **Not fun-first.** It is an argument with a game's shape. If a beat is
  entertaining but does not move the goal, it goes.

## The rule that governs the copy

The premise is true and its ambiguity is the game: **a rule can be fixed and
still not be independent of what you do.** Most people hear "fixed" as
"invariant to me". We say the true thing and never resolve the ambiguity for
them.

So: nothing before the reveal may name the mechanism — no reacting, responding,
predicting, adapting, watching, reading. Not in copy, not as an option, not by
negation ("that wasn't a coin" is most of the way to telling them).

## Positioning

> A two-box game where the other player is reading you.

The asset that travels is not the game, it is the finding: **the adversary is
deterministic, and once you can see its state it is fully exploitable — it only
beats agents that refuse to model it.** The game is the proof of that sentence.

## Shape

Build the **toy** properly. Position it as the **paper's playable companion**.
Hold the **format** — a human in the agent's seat, across the other seven
gridworlds — as an option that instance one has to earn.

## Analytics

Explicit opt-in at the debrief, nothing before it. An app about being profiled
from your behaviour does not get to quietly profile you from your behaviour.
Accepted cost: a much smaller sample, and one third-party request where there
were none.

## Order of work

1. Replay/share URL — the seeded engine already supports it and nothing exposes
   it. Launch blocker: without it there is no share loop.
2. Opt-in submission of the free-text answer, so discovery rate exists.
3. Mobile Safari pass. Untested, and it is the primary target.
4. The write-up of the finding.
