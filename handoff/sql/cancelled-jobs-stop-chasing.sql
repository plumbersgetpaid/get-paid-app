-- Cancelling a job must stop the payment machinery for its invoice.
--
-- Found via real use (20 Aug 2026): cancel only set jobs.status='cancelled',
-- but the outstanding_invoices view - which feeds the automatic 3/7/14-day
-- chasers, the Work > Invoices overdue/awaiting lists, and the Today
-- outstanding total - filtered only on invoice status. So a cancelled job's
-- unpaid invoice kept being chased: automatic payment demands to a customer
-- whose job was called off.
--
-- Fix: exclude cancelled jobs from the view. The invoice itself stays on
-- record (full history at /invoices, exports, PDFs all read the invoices
-- table directly) - it just stops being treated as money to collect.
--
-- Run once in the Supabase SQL editor.

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
  i.business_id
from invoices i
join jobs j on j.id = i.job_id
join customers c on c.id = j.customer_id
where i.status != 'paid'
  and j.status != 'cancelled'
order by i.due_date asc;

-- create or replace can reset view options - re-assert the audit's rule:
-- security_invoker so the view runs as whoever queries it, never as owner.
alter view outstanding_invoices set (security_invoker = true);
