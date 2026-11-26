# Monthly Outgoings

A tick-list of monthly bills that syncs between devices with Supabase and installs on iPhone as a home-screen app.

## Setup

### 1. Supabase
1. Create a free project at supabase.com.
2. **SQL Editor → New query**: paste in `supabase/schema.sql` and run it.
3. **Project Settings → API**: copy the Project URL and the anon (or publishable) key into `config.js`.
4. Optional: **Authentication → Sign In / Providers → Email**: turn off "Confirm email" so you can sign in straight away.
5. After you've created your account in the app, turn off "Allow new users to sign up" so nobody else can register.

The anon key is meant to be public. Row level security means each account can only read and write its own row.

### 2. Host it (GitHub Pages)
1. Push to GitHub.
2. Repo **Settings → Pages**: set Source to "Deploy from a branch", branch `main`, folder `/ (root)`.
3. The app goes live at `https://<username>.github.io/monthlyoutgoings/`.
4. In Supabase, go to **Authentication → URL Configuration** and set the Site URL to that address, so confirmation emails link back to it.

### 3. Install on iPhone
Open the URL in Safari, tap **Share → Add to Home Screen**, then open the app from the new icon and sign in.
Your phone keeps its own sign-in, separate from Safari, so sign in once inside the installed app.

## How sync works
- The list is saved on the device first, so it works offline. Edits upload to Supabase about half a second after you make them.
- Other devices get changes live while they're open, and catch up when the app returns to the foreground.
- If you edited offline, the newer copy wins when the device reconnects.

## Updating
When you push changes, the installed app picks them up the next time it opens. Change the cache name `V` in `sw.js` to force a refresh.

## Monzo auto-import

Monzo sends every new transaction to `/api/monzo-webhook`, a Vercel function that saves it to the `monzo_transactions` table. The tracker then shows "From Monzo this month": money out by category, plus money in. Your manual list stays as it is.

**What gets saved:** card payments, Direct Debits, payments to and from people, and salary.
**What's skipped:** pot transfers, top-ups, declined payments and zero-amount card checks.
**How refunds count:** a refund from a merchant reduces that category's spending instead of counting as income.

### 1. Database
Create your account in the app first, then run `supabase/monzo.sql` in the SQL Editor. It gives read access to that first account automatically.

### 2. Vercel environment variables
In Vercel, go to Project → Settings → Environment Variables, add these for Production, then redeploy:

| Name | Value |
|---|---|
| `MONZO_WEBHOOK_SECRET` | A long random string. Generate one with `openssl rand -hex 32`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **secret** key (`sb_secret_...`), or the legacy `service_role` key |

Never put these in the code or give them a `NEXT_PUBLIC_` prefix. Only the server function reads them.

### 3. Register the webhook with Monzo
You run this yourself. Get an access token from developers.monzo.com and approve it in the Monzo app. Then, in your terminal:

```sh
export MONZO_TOKEN='...'            # from developers.monzo.com
export MONZO_WEBHOOK_SECRET='...'   # the same value you put in Vercel

# Find your account id (acc_...)
curl -s https://api.monzo.com/accounts -H "Authorization: Bearer $MONZO_TOKEN"
export MONZO_ACCOUNT_ID='acc_...'

# Register the webhook
curl -X POST https://api.monzo.com/webhooks \
  -H "Authorization: Bearer $MONZO_TOKEN" \
  -d "account_id=$MONZO_ACCOUNT_ID" \
  --data-urlencode "url=https://monthlyoutgoings.vercel.app/api/monzo-webhook?key=$MONZO_WEBHOOK_SECRET"

# Check it, or remove it later
curl -s "https://api.monzo.com/webhooks?account_id=$MONZO_ACCOUNT_ID" -H "Authorization: Bearer $MONZO_TOKEN"
curl -X DELETE https://api.monzo.com/webhooks/<webhook_id> -H "Authorization: Bearer $MONZO_TOKEN"
```

### Limitations
- Only transactions made after you register the webhook are imported.
- Monzo sends nothing when a payment settles, so `settled` is usually empty. A few amounts, such as foreign or pre-authorised payments, can change at settlement and will keep their original value here.
