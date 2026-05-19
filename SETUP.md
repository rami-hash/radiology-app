# How to Deploy the Secure Proxy

## What changed

Before: your Power Automate URLs and passwords lived inside `app_final.js`
(visible to anyone who opened DevTools).

After:
```
Browser  →  Cloudflare Worker (your proxy)  →  Power Automate
                    ↑
            secrets live here,
            encrypted by Cloudflare
```

Your `app_final.js` now only contains one URL — your Worker — and nothing secret.

---

## Step 1 — Create a free Cloudflare account

Go to https://dash.cloudflare.com/sign-up and create a free account.
The free plan is enough for this.

---

## Step 2 — Install Wrangler (Cloudflare's CLI)

You need Node.js installed (https://nodejs.org).

```bash
npm install -g wrangler
wrangler login
```

`wrangler login` will open a browser window — just click Allow.

---

## Step 3 — Deploy the Worker

Inside the folder that contains `worker.js` and `wrangler.toml`:

```bash
wrangler deploy
```

You'll see output like:
```
Deployed radiology-course-proxy to
https://radiology-course-proxy.YOUR-SUBDOMAIN.workers.dev
```

Copy that URL — you'll need it in the next steps.

---

## Step 4 — Add your secrets (encrypted, never in code)

Run each command below. It will prompt you to paste the value.
The value is encrypted by Cloudflare and never stored in any file.

```bash
wrangler secret put ACCESS_CODE
# paste: RADIOLOGY2024  (or whatever your current code is)

wrangler secret put ADMIN_CODE
# paste: ADMIN2024  (or whatever your current code is)

wrangler secret put CASES_URL
# paste: your full Power Automate cases flow URL

wrangler secret put SETTINGS_URL
# paste: your full Power Automate settings flow URL

wrangler secret put ADMIN_FLOW_URL
# paste: your full Power Automate admin flow URL

wrangler secret put FLOW_URL
# paste: your full Power Automate scores/leaderboard flow URL

wrangler secret put PROGRESS_URL
# paste: your full Power Automate progress flow URL
```

---

## Step 5 — Update app_final.js with your Worker URL

Open `app_final.js` and find this line near the top:

```js
const PROXY_URL = "https://radiology-course-proxy.YOUR-SUBDOMAIN.workers.dev";
```

Replace `YOUR-SUBDOMAIN` with the actual subdomain from Step 3.

---

## Step 6 — Test it

Open your `index_final.html` in a browser.
- Try logging in with the access code → should work.
- Try logging in with a wrong code → should be rejected.
- Open DevTools → Network tab → you should only see requests going to
  `radiology-course-proxy.*.workers.dev`, never to `powerplatform.com`.

---

## Step 7 — Push to GitHub safely

Now that secrets are out of your code, you can push publicly:

```bash
git add app_final.js index_final.html worker.js wrangler.toml .gitignore
git commit -m "Move secrets server-side via Cloudflare Worker"
git push
```

The `.gitignore` ensures `.env` and `.dev.vars` are never committed.

---

## Changing secrets later

To change your access code or any URL, just run:

```bash
wrangler secret put ACCESS_CODE
```

No code changes needed. The Worker picks up the new value immediately.

---

## Restricting which websites can call your Worker (optional but recommended)

Open `worker.js` and find this line in the `corsHeaders` function:

```js
"Access-Control-Allow-Origin": "*",
```

Replace `*` with your exact website URL:

```js
"Access-Control-Allow-Origin": "https://www.myebr.org",
```

This means only your site can call your Worker — no one else can use it even
if they find the Worker URL.

Then redeploy:
```bash
wrangler deploy
```
