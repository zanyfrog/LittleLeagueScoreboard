# @ll-score/testing

Synthetic fixtures, builders, and seed loaders for development and automated
tests. All names and records are fictional.

The sample league contains six teams with eleven players per team and three
games covering every team.

Load it into the configured local JSONL data directory from the repository
root:

```powershell
pnpm seed:sample
```

Set `LL_SCORE_DATA_DIR` to seed another directory.
