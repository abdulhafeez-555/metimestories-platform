# Me Time Stories — Family Frontend

The parent/child-facing frontend, built fresh against the existing backend.
This is a new, standalone Vite project — separate from the old player-portal
repo. The academy/internal/marketing systems live elsewhere and are out of
scope here.

## Pages built

| Route | Page | Purpose |
|---|---|---|
| `/` | PlaceholderHome | Temporary landing screen — real homepage integrated later |
| `/family/register` | ParentRegister | Create a parent account |
| `/family/login` | ParentLogin | Two-step login (password → email code) |
| `/family/dashboard` | ParentDashboard | List children, add a child |
| `/family/add-child` | AddChild | Create a child profile + appearance |
| `/family/child-login` | ChildPinLogin | Child enters their 4-digit PIN |
| `/family/stories` | StoryLibrary | Browse stories by value |
| `/family/story/:storyId` | FamilyStoryReader | The personalised story, scene by scene |

## Running locally

You need the backend running first, in a separate terminal:

```
cd C:\MeTimeStories\platform
npx ts-node src\index.ts
```

Then, in this folder:

```
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

API calls to `/api/*` are automatically proxied to `http://localhost:3000`
(the backend) — see `vite.config.ts`. No CORS setup needed for local dev.

## Every API call in this project was verified against the real backend

Every function in `src/lib/familyApi.ts` was checked field-by-field against
the actual Fastify route handlers before being trusted — request body shape,
response shape, which token (parent vs child) gets attached, and every error
status code. See the team's review notes for the full trace.
