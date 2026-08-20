# Live Supabase schema (reference)

Probed read-only via PostgREST introspection + per-table select probes on
20 Aug 2026. **23 tables + 1 view** (email_log and help_questions added 20 Aug 2026). This is the accurate inventory; the
committed `schema.sql` covers only 4 early tables and must not be trusted or
deployed from. Supabase itself is the source of truth — this file is a map.

`pk`/`fk` from PostgREST introspection; every relation answered a live probe.

## businesses
- id (uuid, NOT NULL, pk)
- name (text, NOT NULL)
- created_at (timestamptz, NOT NULL)

## team_members
- id (uuid, NOT NULL, pk)
- name (text, NOT NULL)
- email (text, NOT NULL)
- password_hash (text, NOT NULL)
- role (text, NOT NULL)
- is_active (boolean, NOT NULL)
- created_at (timestamptz, NOT NULL)
- reset_token (text)
- reset_token_expires (timestamptz)
- can_invoice / can_see_client_database / can_create_quote / can_create_job / can_create_recurring_job / can_reschedule (boolean, NOT NULL)
- business_id (uuid, fk -> businesses.id)
- is_platform_admin (boolean, NOT NULL)
- session_version (int4, NOT NULL)

## subscriptions
- business_id (uuid, NOT NULL, pk)
- status (text, NOT NULL)
- seats (int4, NOT NULL)
- trial_ends_at (timestamptz)
- stripe_customer_id (text)
- stripe_subscription_id (text)
- created_at / updated_at (timestamptz)
- current_period_end (timestamptz)
- canceled_at (timestamptz)

## customers
- id (uuid, NOT NULL, pk)
- name (text, NOT NULL)
- phone (text)
- email (text)
- address (text)
- created_at (timestamptz)
- business_id (uuid, fk -> businesses.id)

## jobs
- id (uuid, NOT NULL, pk)
- customer_id (uuid, NOT NULL, fk -> customers.id)
- job_type (text)
- amount (numeric, NOT NULL)
- status (text, NOT NULL)
- completed_at / created_at / quote_sent_at / accepted_at / declined_at / quote_chased_at (timestamptz)
- scheduled_start / scheduled_end / reminder_sent_at (timestamptz)
- location (text)
- completion_note (text)
- time_confirmed (boolean)
- assigned_to (uuid, fk -> team_members.id)
- created_by (uuid, fk -> team_members.id)
- business_id (uuid, fk -> businesses.id)

## invoices
- id (uuid, NOT NULL, pk)
- job_id (uuid, NOT NULL, fk -> jobs.id) — UNIQUE (invoices_job_id_unique, applied 20 Aug 2026)
- amount (numeric, NOT NULL)
- due_date (date, NOT NULL)
- sent_at / paid_at / created_at (timestamptz)
- status (text, NOT NULL)
- invoice_number (int4, NOT NULL)
- payment_link (text)
- vat_rate (numeric) — snapshot at creation; null = not VAT-registered then
- vat_number (text) — snapshot at creation
- business_id (uuid, fk -> businesses.id)

## chase_log
- id (uuid, NOT NULL, pk)
- invoice_id (uuid, NOT NULL, fk -> invoices.id)
- message (text)
- channel (text)
- sent_at (timestamptz)
- business_id (uuid, fk -> businesses.id)

## job_notes
- id (uuid, NOT NULL, pk)
- job_id (uuid, NOT NULL, fk -> jobs.id)
- note (text, NOT NULL)
- important (boolean)
- created_at (timestamptz)
- image_url (text) — legacy, no longer written (signed URLs from path)
- image_storage_path (text) — bucket: job-note-images
- created_by (uuid, fk -> team_members.id)
- business_id (uuid, fk -> businesses.id)

## job_photos
- id (uuid, NOT NULL, pk)
- job_id (uuid, NOT NULL, fk -> jobs.id)
- url (text) — legacy, no longer written (signed URLs from path)
- storage_path (text, NOT NULL) — bucket: job-photos
- label (text, NOT NULL)
- created_at (timestamptz)
- business_id (uuid, fk -> businesses.id)

## job_shares
- id (uuid, NOT NULL, pk)
- job_id (uuid, NOT NULL, fk -> jobs.id)
- team_member_id (uuid, NOT NULL, fk -> team_members.id)
- created_at (timestamptz, NOT NULL)
- business_id (uuid, fk -> businesses.id)

## recurring_jobs
- id (uuid, NOT NULL, pk)
- customer_id (uuid, NOT NULL, fk -> customers.id)
- job_type (text)
- location (text)
- amount (numeric)
- frequency_value (int4, NOT NULL)
- frequency_unit (text, NOT NULL)
- next_occurrence (date, NOT NULL)
- auto_invoice (boolean, NOT NULL)
- active (boolean, NOT NULL)
- created_at (timestamptz)
- confirm_time_later (boolean)
- preferred_time (text)
- notify_email (boolean)
- next_occurrence_time (text)
- created_by (uuid, fk -> team_members.id)
- assigned_to (uuid, fk -> team_members.id)
- business_id (uuid, fk -> businesses.id)
- NOTE: notify_whatsapp has been dropped — the old CLAUDE.md follow-up is done.

## recurring_job_shares
- id (uuid, NOT NULL, pk)
- recurring_job_id (uuid, NOT NULL, fk -> recurring_jobs.id)
- team_member_id (uuid, NOT NULL, fk -> team_members.id)
- created_at (timestamptz, NOT NULL)
- business_id (uuid, fk -> businesses.id)

## personal_events
- id (uuid, NOT NULL, pk)
- title (text, NOT NULL)
- notes (text)
- scheduled_start / scheduled_end (timestamptz, NOT NULL)
- created_at (timestamptz)
- created_by (uuid, fk -> team_members.id)
- business_id (uuid, fk -> businesses.id)
- reminder_sent_at (timestamptz)

## reminder_shares
- id (uuid, NOT NULL, pk)
- reminder_id (uuid, NOT NULL, fk -> personal_events.id)
- team_member_id (uuid, NOT NULL, fk -> team_members.id)
- created_at (timestamptz, NOT NULL)
- business_id (uuid, fk -> businesses.id)

## business_settings
- id (int4, NOT NULL, pk)
- business_name, contact_email, contact_phone, accent_color, logo_url, invoice_note, header_tagline, payment_terms, bank_details, currency, google_review_link (text)
- include_weekends, send_review_requests (boolean)
- vat_registered (boolean, NOT NULL, default false)
- vat_number (text)
- vat_rate (numeric, NOT NULL, default 20)
- vat_price_entry (text, NOT NULL, default 'inclusive') — 'inclusive' | 'exclusive'
- updated_at (timestamptz)
- business_id (uuid, fk -> businesses.id)

## message_templates
- key (text, NOT NULL, pk)
- subject (text)
- body (text, NOT NULL)
- updated_at (timestamptz)
- business_id (uuid, NOT NULL, pk, fk -> businesses.id) — composite pk (key, business_id)

## platform_settings
- id (int4, NOT NULL, pk)
- app_logo_url / sign_off_logo_url / favicon_url (text)
- updated_at (timestamptz)

## push_subscriptions
- id (uuid, NOT NULL, pk)
- business_id (uuid, NOT NULL) — no FK
- team_member_id (uuid, NOT NULL) — no FK (so team/delete removes these rows explicitly)
- endpoint (text, NOT NULL)
- p256dh (text, NOT NULL)
- auth (text, NOT NULL)
- created_at (timestamptz, NOT NULL)

## processed_requests
- request_id (uuid, NOT NULL, pk)
- business_id (uuid, NOT NULL) — no FK
- endpoint (text, NOT NULL)
- created_at (timestamptz, NOT NULL)

## login_attempts
- ip (text, NOT NULL, pk) — stores a scoped key ("login:<ip>" / "reset:<ip>")
- attempts (int4, NOT NULL)
- window_started_at (timestamptz, NOT NULL)
- locked_until (timestamptz)
- Written atomically by record_login_attempt() (supabase/login-throttle.sql), which also self-purges rows >24h old.

## ignored_duplicates
- id (uuid, NOT NULL, pk)
- customer_id_a / customer_id_b (uuid, NOT NULL) — no FK to customers
- created_at (timestamptz)
- business_id (uuid, fk -> businesses.id)

## email_log
- id (uuid, NOT NULL, pk, default gen_random_uuid())
- business_id (uuid, NOT NULL) — no FK; service-role only (RLS on, no policies)
- job_id (uuid)
- customer_id (uuid)
- email_to (text)
- kind (text, NOT NULL) — quote | booking_confirmation | invoice | quote_chase | review_request
- subject (text)
- sent_at (timestamptz, NOT NULL, default now())

## help_questions
- id (uuid, NOT NULL, pk, default gen_random_uuid())
- business_id (uuid, NOT NULL) — no FK; service-role only (RLS on, no policies)
- team_member_id (uuid)
- question (text, NOT NULL)
- answer (text)
- created_at (timestamptz, NOT NULL, default now())

## outstanding_invoices (VIEW, security_invoker)
Excludes paid invoices AND invoices of cancelled jobs (supabase/cancelled-jobs-stop-chasing.sql).
- invoice_id (uuid)
- invoice_number (int4)
- customer_name, phone, email, job_type, location (text)
- amount (numeric)
- due_date (date)
- days_overdue (int4)
- business_id (uuid, fk -> businesses.id)
