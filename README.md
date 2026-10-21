# CodeMate — Your codebase, understood.

MERN app that imports public GitHub repositories as saved projects and helps you learn them.

## Run locally

```bash
# server
cd server && cp .env.example .env   # fill in MONGODB_URI, SESSION_SECRET (AI keys later)
npm install && npm run dev          # http://localhost:5000/api/health

# client
cd client && cp .env.example .env
npm install && npm run dev          # http://localhost:5173
```

The server starts without MongoDB or AI credentials and reports their state at `/api/health`.

## Projects design

- Importing reads public repo metadata and the head commit SHA from the GitHub REST API. Set `GITHUB_TOKEN` to raise API rate limits.
- Project numbers come from an atomic per-user counter, so a number is never reused after deleting a project.
- A repository can only be saved once per user; importing it again points to the existing project instead of overwriting it.
- Every `/api/projects/:projectId/...` route goes through `loadOwnedProject`, which queries by id **and** owner. Someone else's project returns 404.
- `project.cascade.js` is the registry later phases use so deleting a project removes all of its data and the delete dialog can list it.
- Languages/frameworks stay empty until analysis (Phases 4-5) finds real evidence; the card shows GitHub's language labelled "(GitHub)".
