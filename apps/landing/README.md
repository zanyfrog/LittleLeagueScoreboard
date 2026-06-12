# ll-score-landing

Runnable Next.js local website for the Little League Scoreboard.

From the repository root:

```powershell
pnpm seed:sample
pnpm landing:dev
```

Open `http://127.0.0.1:3000`.

The server composes `@ll-score/game-engine`, JSONL storage, and local I-AM.
Browser code uses Landing API routes and never reads storage directly.
