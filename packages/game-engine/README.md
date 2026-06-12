# @ll-score/game-engine

Canonical authorized application services for rosters, lineups, scoring,
position changes, and replay. The package depends on storage interfaces and
the I-AM contract, never on JSONL, SQL, Fastify, or Landing.

Authorization vocabulary:

```text
read   team-data     team scope
read   game-scoring  game scope
write  game-scoring  game scope
```

`Scorer` and `Platform Admin` can use scoring commands through the built-in
local I-AM policies. Team-scoped roster reads use `team-data`.
