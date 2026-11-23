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
