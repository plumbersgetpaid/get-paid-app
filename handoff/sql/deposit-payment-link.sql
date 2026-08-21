-- Optional per-job payment link for the deposit (pasted on the quote /
-- quick-book form). Included in the deposit request + reminder emails as
-- "Pay online: <link>" alongside the bank details, and pre-fills the final
-- invoice's payment link. Run once in the Supabase SQL editor.
alter table jobs
  add column if not exists deposit_payment_link text;
