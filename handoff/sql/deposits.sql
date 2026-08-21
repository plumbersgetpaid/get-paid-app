-- Deposits (v1: request + track; money still moves by bank transfer /
-- the business's own payment link - PatchUp never touches it).
--
-- Design (agreed 20 Aug 2026): a per-quote tick box + amount (no settings,
-- no thresholds). The quote email states total / deposit / remaining; the
-- deposit REQUEST email fires when the customer accepts; "Mark deposit
-- received" records an adjustable received-on date (backdatable - people
-- mark things late; the record should say when the money actually arrived);
-- the final invoice deducts it and prints the date. Advisory only - an
-- unpaid deposit never blocks booking.
--
-- No new tables: columns ride the existing jobs/invoices policies, and the
-- 30-day deletion already removes these rows whole. Run once in the
-- Supabase SQL editor BEFORE deploying the matching code.

alter table jobs
  add column if not exists deposit_amount numeric,
  add column if not exists deposit_requested_at timestamptz,
  add column if not exists deposit_received_on date;

-- Snapshot on the invoice at creation (tax documents never change later).
alter table invoices
  add column if not exists deposit_amount numeric,
  add column if not exists deposit_received_on date;

-- The view feeds the chasers, the overdue/awaiting lists and the money
-- totals - they must all talk about the BALANCE still owed, not the full
-- total, once a deposit has been received. New columns appended (existing
-- column order unchanged, as create-or-replace requires).
create or replace view outstanding_invoices as
select
  i.id as invoice_id,
  i.invoice_number,
  c.name as customer_name,
  c.phone,
  c.email,
  j.job_type,
  j.location,
  i.amount,
  i.due_date,
  (current_date - i.due_date) as days_overdue,
  i.business_id,
  i.deposit_amount,
  i.deposit_received_on
from invoices i
join jobs j on j.id = i.job_id
join customers c on c.id = j.customer_id
where i.status != 'paid'
  and j.status != 'cancelled'
order by i.due_date asc;

alter view outstanding_invoices set (security_invoker = true);
