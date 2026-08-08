-- Run this in the Supabase SQL Editor to set up your database.
-- Go to: Supabase Dashboard -> SQL Editor -> New Query -> paste this -> Run

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) not null,
  job_type text,
  amount numeric(10,2) not null,
  status text not null default 'in_progress', -- in_progress | complete | invoiced | paid
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) not null,
  amount numeric(10,2) not null,
  due_date date not null,
  sent_at timestamptz,
  paid_at timestamptz,
  status text not null default 'unpaid', -- unpaid | paid | overdue
  created_at timestamptz default now()
);

create table chase_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) not null,
  message text,
  channel text, -- email | sms | whatsapp
  sent_at timestamptz default now()
);

-- Helpful view: everything currently owed, oldest first
create view outstanding_invoices as
select
  i.id as invoice_id,
  c.name as customer_name,
  c.phone,
  c.email,
  j.job_type,
  i.amount,
  i.due_date,
  (current_date - i.due_date) as days_overdue
from invoices i
join jobs j on j.id = i.job_id
join customers c on c.id = j.customer_id
where i.status != 'paid'
order by i.due_date asc;
