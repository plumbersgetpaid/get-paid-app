-- One invoice per job.
--
-- app/api/jobs/complete checks "does this job already have an invoice?" then
-- inserts - a check-then-act with no DB constraint. Two concurrent completes
-- (an office submit racing an offline outbox replay, each with its own
-- request_id, so idempotency doesn't dedupe them) can both pass the check and
-- insert two invoices with two numbers, emailing the homeowner twice. This
-- constraint makes the database reject the second one; the route catches the
-- 23505 and treats completion as already done.
--
-- Run in the Supabase SQL editor. STEP 1 must return zero rows before STEP 2
-- will succeed - if it returns any, two invoices already exist for one job and
-- must be reconciled by hand first.

-- STEP 1: check for existing duplicates (expect zero rows).
select job_id, count(*)
from invoices
group by job_id
having count(*) > 1;

-- STEP 2: add the constraint (run only if STEP 1 was empty).
alter table invoices
  add constraint invoices_job_id_unique unique (job_id);
