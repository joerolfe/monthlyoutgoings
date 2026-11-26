// Vercel serverless function: POST /api/monzo-webhook?key=<MONZO_WEBHOOK_SECRET>
// Monzo calls this for every new transaction. We keep real spending and income, and store it in Supabase.
// Env (Vercel, server only): MONZO_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY. Never prefix these with NEXT_PUBLIC_.
const crypto = require('crypto');

const SUPABASE_URL = 'https://oepxdgttfheyrllzhhlx.supabase.co';

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Why a transaction is left out, or null to keep it.
function skipReason(tx) {
  if (!tx || !tx.id || typeof tx.amount !== 'number') return 'malformed';
  if (tx.amount === 0) return 'zero amount';                                      // card checks, holds
  if (tx.decline_reason) return 'declined';                                       // never left the account
  if ((tx.metadata && tx.metadata.pot_id) || tx.scheme === 'uk_retail_pot') return 'pot transfer';
  if (tx.is_load) return 'top-up';
  return null;                                                                    // card spend, DDs, payments to/from people, salary
}

function toRow(tx) {
  const merchant = tx.merchant && typeof tx.merchant === 'object' ? tx.merchant.name : null;
  const counterparty = tx.counterparty && tx.counterparty.name;                   // people you pay / who pay you
  return {
    id: tx.id,
    amount_pence: tx.amount,
    currency: tx.currency,
    merchant_name: merchant || counterparty || null,
    category: tx.category || null,
    description: tx.description || null,
    created_at: tx.created,
    settled: tx.settled || null,                                                  // Monzo sends "" until settled
    raw: tx,
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!safeEqual(req.query && req.query.key, process.env.MONZO_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'unauthorised' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || body.type !== 'transaction.created') return res.status(200).json({ ignored: 'event type' });

  const reason = skipReason(body.data);
  if (reason) return res.status(200).json({ skipped: reason });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return res.status(500).json({ error: 'server not configured' });
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;            // legacy JWT service_role key

  const r = await fetch(SUPABASE_URL + '/rest/v1/monzo_transactions?on_conflict=id', {
    method: 'POST', headers, body: JSON.stringify(toRow(body.data)),
  });
  // A non-200 makes Monzo retry later, so a brief Supabase outage doesn't lose the transaction.
  if (!r.ok) { console.error('supabase upsert failed', r.status, await r.text()); return res.status(500).json({ error: 'store failed' }); }
  return res.status(200).json({ stored: body.data.id });
};
