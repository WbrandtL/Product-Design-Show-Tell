# Deploying reading-backend for review

Gist (the desktop app) needs a backend it can reach over the network so
reviewers never have to install Python or handle your Groq key themselves.
This hosts just the backend - the Electron app still runs locally on each
reviewer's machine (see the note in `../gist/README.md` about why the
floating widget can't itself be "hosted").

This only covers steps that require your own accounts/credentials - I can't
create accounts or enter secrets on your behalf, but I can do everything
else (write the Dockerfile, wire the app to the URL, test it end to end)
once you've done these.

## 1. Put the code somewhere Render can see it

Render deploys from a Git repo. If this project isn't on GitHub yet:

1. Create an empty repo at github.com/new (your account).
2. Tell me the repo URL and I'll commit and push what's needed.

## 2. Create a Render account and web service

1. Sign up at render.com (free tier is enough for this).
2. **New +** -> **Web Service** -> connect the GitHub repo from step 1.
3. **Root Directory**: `reading-backend`
4. Render will auto-detect the `Dockerfile` in that directory - leave the
   runtime as Docker.
5. **Instance type**: Free is fine for a review period.
6. Under **Environment**, add these (values typed directly into Render's
   dashboard - never share them with me or anyone else):
   - `GROQ_API_KEY` = your Groq key
   - `GROQ_MODEL` = `llama-3.3-70b-versatile` (recommended - see note below)
   - `LLM_PROVIDER` = `groq`
7. Click **Deploy**. First build takes a few minutes.
8. Once live, copy the URL Render gives you (looks like
   `https://gist-backend-xxxx.onrender.com`) and send it to me.

## 3. What I'll do once you have that URL

- Set it as `HOSTED_BACKEND_URL` in `gist/lib/backend.js`.
- Verify `GET <url>/api/health` responds and run one real `/api/explain`
  call against it to confirm the deployed key/model work.
- Build the distributable app (`npm run dist` in `gist/`) so it talks to
  that URL instead of localhost, and do a final click-through test myself.

## Why `llama-3.3-70b-versatile` instead of the current `openai/gpt-oss-120b`

`gpt-oss-120b` is a reasoning model - in testing, one successful call spent
5,579 of its 6,513 completion tokens on internal chain-of-thought before it
ever wrote the output JSON, and on a demanding passage it sometimes runs out
of budget before finishing and fails outright (`json_validate_failed`). A
non-reasoning model skips that overhead entirely: faster per request, and
each request reserves far fewer tokens against the account's fixed 8,000
TPM cap - meaningfully more headroom if a few reviewers try it around the
same time. Same free Groq account, same key, no code change beyond the
`GROQ_MODEL` value.

## About Render's free tier

A free service sleeps after 15 minutes with no traffic and takes ~30-50s to
wake on the next request. Gist's own startup already tolerates this: the
widget icon appears immediately and shows "waking up..." rather than
freezing, and it waits up to 45s for the backend before giving up (see the
comment above `ensureBackend()` in `gist/lib/backend.js` and the "waking up"
handling in `gist/main.js`). A first request per idle period will just take
longer, not fail - tested by simulating a slow backend.

## Rate limits under review load

The 8,000 TPM cap is shared across everyone hitting your key at once. With
the faster model this should comfortably handle a handful of reviewers
clicking through sequentially; heavy simultaneous use could still hit
transient 429s, which the app already retries automatically rather than
failing outright.
