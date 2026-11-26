// One-off import of past Monzo transactions into the tracker.
// It sends each transaction through the live webhook, so the same filtering applies
// (pot transfers, top-ups and declines are skipped) and re-running never creates duplicates.
//
// Usage (in Terminal, from this folder):
//   export MONZO_TOKEN='...'            # fresh token from developers.monzo.com, approved in the app
//   export MONZO_ACCOUNT_ID='acc_...'
//   export MONZO_WEBHOOK_SECRET='...'   # same value as in Vercel
//   node scripts/monzo-import.mjs        # optional: add a number of days, e.g. 365
//
// Monzo only allows reading transactions older than 90 days in the first 5 minutes after you
// approve access in the app. Run this straight after approving to get the full history.

const { MONZO_TOKEN, MONZO_ACCOUNT_ID, MONZO_WEBHOOK_SECRET } = process.env;
const WEBHOOK = 'https://monthlyoutgoings.vercel.app/api/monzo-webhook';
const days = Number(process.argv[2] || 365);

for (const [name, v] of Object.entries({ MONZO_TOKEN, MONZO_ACCOUNT_ID, MONZO_WEBHOOK_SECRET })) {
  if (!v) { console.error(`Missing ${name}. See the instructions at the top of this file.`); process.exit(1); }
}

async function monzo(path) {
  const r = await fetch('https://api.monzo.com' + path, { headers: { Authorization: 'Bearer ' + MONZO_TOKEN } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = body.message || body.code || r.statusText;
    if (r.status === 403) throw new Error(`Monzo said no (${msg}). Approve the login in the Monzo app, or get a fresh token. Older than 90 days only works in the first 5 minutes after approving.`);
    throw new Error(`Monzo error ${r.status}: ${msg}`);
  }
  return body;
}

async function send(tx) {
  const r = await fetch(`${WEBHOOK}?key=${encodeURIComponent(MONZO_WEBHOOK_SECRET)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'transaction.created', data: tx }),
  });
  if (r.status === 401) throw new Error('The webhook rejected the secret. Check MONZO_WEBHOOK_SECRET matches Vercel.');
  return r.json().catch(() => ({}));
}

let since = new Date(Date.now() - days * 864e5).toISOString();
const before = new Date().toISOString();
let fetched = 0, stored = 0, skipped = 0;
console.log(`Importing Monzo transactions from the last ${days} days…`);

try {
  for (;;) {
    const q = `/transactions?account_id=${MONZO_ACCOUNT_ID}&expand[]=merchant&limit=100&since=${encodeURIComponent(since)}&before=${encodeURIComponent(before)}`;
    const { transactions = [] } = await monzo(q);
    if (!transactions.length) break;
    for (const tx of transactions) {
      const res = await send(tx);
      fetched++;
      if (res.stored) stored++; else skipped++;
    }
    process.stdout.write(`\r${fetched} checked · ${stored} saved · ${skipped} skipped (pots, top-ups, declines)`);
    if (transactions.length < 100) break;
    since = transactions[transactions.length - 1].id;   // Monzo paginates by the last transaction id
  }
  console.log(`\nDone. Open the app and pull down to refresh.`);
} catch (e) {
  console.error(`\n${e.message}`);
  if (fetched) console.error(`${fetched} transactions were processed before the error. Re-running is safe.`);
  process.exit(1);
}
