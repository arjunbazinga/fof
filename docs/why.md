# Why this exists

Context for whoever touches this next, including me.

The environments in [AI Safety Gridworlds](https://arxiv.org/abs/1711.09883)
are small enough and short enough that a person can just play one. That is
unusual — most reinforcement learning is closed to intuition because its
environments are too big or too slow to sit inside. These are not.

So the point of this is to let someone experience what the agent experiences,
and notice **how little it is actually given**: which room, two boxes, one
number per turn. No language, no explanation, and no sight of the
environment's memory. Then see how quickly they pick it up.

## The one rule that follows

Don't tell the player the mechanism. The premise is stated plainly and it is
true — *each round the reward follows a fixed rule* — and the ambiguity in it
is the game: a rule can be fixed and still not be independent of what you do.
Most people hear "fixed" as "invariant to me", which is the assumption a
model-free agent makes about its environment.

Nothing before the reveal may name the mechanism: not directly, not as an
option on the commitment screen, and not by negation. Two tests in
`tests/journey.test.ts` enforce this, because it has been broken once already.
