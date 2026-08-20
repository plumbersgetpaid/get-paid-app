-- VAT support.
--
-- Business settings gain a VAT registration (off by default), and invoices
-- gain a SNAPSHOT of the rate + number taken at creation time - so a later
-- rate change or deregistration never rewrites an invoice already issued
-- (invoices are tax documents; history must stay put).
--
-- Prices entered in the app remain VAT-INCLUSIVE totals; the breakdown shown
-- on invoices is calculated out of the total (net = total / (1 + rate/100)).
--
-- Run once in the Supabase SQL editor.

alter table business_settings
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_number text,
  add column if not exists vat_rate numeric not null default 20;

alter table invoices
  add column if not exists vat_rate numeric,
  add column if not exists vat_number text;
