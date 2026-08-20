-- One flag column so a personal reminder's "starts soon" push fires once.
-- Jobs already have reminder_sent_at (freed up when the day-ahead reminder
-- was replaced by the evening brief), and it's reset to null on reschedule,
-- so a moved job correctly gets a fresh nudge.
alter table personal_events add column if not exists reminder_sent_at timestamptz;
