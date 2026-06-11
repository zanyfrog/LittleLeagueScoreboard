# @ll-score/rosters

Reusable roster and lineup view models and components for batting order,
positions, bench status, current batter, pitcher, catcher, and opponent aliases.

Planned internal structure:

```text
src/model/
src/application/
src/components/
src/index.ts
tests/
```

The package consumes `RosterService` results and emits typed lineup or position
intents. It never calls persistence repositories.
