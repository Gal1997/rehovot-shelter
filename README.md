# כלביית רחובות — מעקב כלבים וחתולים

A rebuilt version of the shelter tracker. It is a normal Next.js app with a local SQLite database, staff logins, and a path to real hosting later.

The original ChatGPT / vinext / D1 project stays in `rehovot-kennel-site-handoff/`. This folder is the one to host.

## What changed from the vibe-coded app

- Every staff member has their own login. Daily kennel work has the same permissions; only admins manage users.
- Dates use Israel time and a real date picker.
- Medication countdown counts from the treatment date, not the report date.
- Dogs and cats no longer share the “one day left” list.
- Animals are added and archived by name. Archived animals can be restored; their history stays.
- Same-symptom reports cannot silently merge. The app asks you to edit the open report.
- Excel download stays on the page and requires login. Whole-kennel export is available after login.
- Typed vaccine names are saved to the quick-pick list.
- Renaming a person, animal, symptom, or vaccine updates related records.

## Demo logins

After seeding:

| User | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Admin |
| `haim` | `staff123` | Staff |
| `yonatan` | `staff123` | Staff |
| `shaked` | `staff123` | Staff |
| `tal` | `staff123` | Staff |

Demo data includes open reports, medications near the end of treatment, history, and planned vaccines.

## Run locally

Needs Node.js 22+.

```bash
cd rehovot-kennel
npm install
copy .env.example .env.local
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Reset the demo database with `npm run db:reset`.

## Hosting later

This is ordinary Next.js. Good options:

1. **A small VPS** (Hetzner, DigitalOcean, Railway) with the SQLite file on disk. Point `www.rehovot-dogs.com` at it.
2. **Vercel + Turso** (hosted libSQL). Set `DATABASE_URL` to the Turso URL and `AUTH_SECRET` to a long random string.
3. Do **not** drop this on OpenAI Sites or generic PHP hosting.

Before production:

- Change every demo password
- Set a new `AUTH_SECRET`
- Turn on HTTPS
- Keep backups of `data/kennel.db`

## Importing the old D1 database

The live D1 data is not in this repo. When you have the dump, we can write an importer into this cleaner schema (unified `animals` + `reports` instead of separate dog/cat tables).
