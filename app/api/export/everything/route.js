import JSZip from "jszip";
import { supabaseAdmin } from "../../../lib/supabaseClient";
import { getCurrentTeamMember } from "../../../lib/auth";
import { EMAIL_KIND_LABELS } from "../../../lib/logEmail";
import { canSeeEverything } from "../../../lib/permissions";
import { getScopedDb } from "../../../lib/scopedSupabaseClient";
import { getBusinessSettings } from "../../../lib/getBusinessSettings";
import { signPaths } from "../../../lib/signedMediaUrls";
import { NextResponse } from "next/server";

// Everything a business has, as one download.
//
// This exists because of the deletion job: 30 days after cancelling, all
// of this is gone for good. A plumber's invoices are their own tax
// records and HMRC expects them kept for six years - so leaving with
// nothing is not an option we can offer.
//
// CSV because it opens in Excel, Numbers and Google Sheets without
// anything being installed, and will still open in ten years. Photos go
// in as actual files rather than links, because links to a deleted
// account are worthless.

// Photos are the only unbounded part. Past this, the files are left out
// and listed in photos.csv with links instead, rather than the whole
// export timing out and producing nothing.
const PHOTO_BYTE_BUDGET = 150 * 1024 * 1024;
const LINK_TTL = 7 * 24 * 60 * 60;

function csvCell(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows, columns) {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = (rows || []).map((r) => columns.map((c) => csvCell(c.value(r))).join(","));
  return [head, ...body].join("\n") + "\n";
}

const date = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const dateTime = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace("T", " ") : "");

export async function GET() {
  const currentMember = await getCurrentTeamMember();
  // Deliberately the broadest permission: this is every customer, every
  // invoice and every photo in one file. A subcontractor with access to
  // their own jobs should not be able to walk off with the business.
  if (!canSeeEverything(currentMember)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const db = await getScopedDb(currentMember);
  const settings = await getBusinessSettings();

  const [
    { data: customers },
    { data: jobs },
    { data: invoices },
    { data: notes },
    { data: recurring },
    { data: photos },
    { data: chaseLog },
    { data: reminders },
    { data: templates },
    { data: team },
  ] = await Promise.all([
    db.from("customers").select("*").order("name"),
    db.from("jobs").select("*").order("created_at"),
    db.from("invoices").select("*").order("created_at"),
    db.from("job_notes").select("*").order("created_at"),
    db.from("recurring_jobs").select("*").order("created_at"),
    db.from("job_photos").select("*").order("created_at"),
    db.from("chase_log").select("*").order("sent_at"),
    db.from("personal_events").select("*").order("scheduled_start"),
    db.from("message_templates").select("*").order("key"),
    db.from("team_members").select("*").order("created_at"),
  ]);

  const customerById = new Map((customers || []).map((c) => [c.id, c]));
  const jobById = new Map((jobs || []).map((j) => [j.id, j]));
  const invoiceById = new Map((invoices || []).map((i) => [i.id, i]));
  const memberById = new Map((team || []).map((m) => [m.id, m]));
  const customerForJob = (jobId) => customerById.get(jobById.get(jobId)?.customer_id);

  const zip = new JSZip();

  zip.file(
    "clients.csv",
    toCsv(customers, [
      { header: "Name", value: (c) => c.name },
      { header: "Phone", value: (c) => c.phone },
      { header: "Email", value: (c) => c.email },
      { header: "Address", value: (c) => c.address },
      { header: "Added", value: (c) => date(c.created_at) },
    ])
  );

  const jobColumns = [
    { header: "Client", value: (j) => customerById.get(j.customer_id)?.name },
    { header: "Job", value: (j) => j.job_type },
    { header: "Location", value: (j) => j.location },
    { header: "Amount", value: (j) => j.amount },
    { header: "Status", value: (j) => j.status },
    { header: "Quote sent", value: (j) => date(j.quote_sent_at) },
    { header: "Accepted", value: (j) => date(j.accepted_at) },
    { header: "Declined", value: (j) => date(j.declined_at) },
    { header: "Scheduled", value: (j) => dateTime(j.scheduled_start) },
    { header: "Completed", value: (j) => date(j.completed_at) },
    { header: "Completion note", value: (j) => j.completion_note },
    { header: "Created", value: (j) => date(j.created_at) },
  ];

  zip.file("jobs.csv", toCsv(jobs, jobColumns));

  // Quotes are jobs that were quoted, pulled out separately because
  // "what did I quote and did it land" is a question people actually ask.
  zip.file("quotes.csv", toCsv((jobs || []).filter((j) => j.quote_sent_at), jobColumns));

  zip.file(
    "invoices.csv",
    toCsv(invoices, [
      { header: "Invoice number", value: (i) => i.invoice_number },
      { header: "Client", value: (i) => customerForJob(i.job_id)?.name },
      { header: "Job", value: (i) => jobById.get(i.job_id)?.job_type },
      { header: "Amount", value: (i) => i.amount },
      { header: "Deposit received", value: (i) => i.deposit_amount || "" },
      { header: "Deposit date", value: (i) => date(i.deposit_received_on) },
      {
        header: "Balance due",
        value: (i) =>
          i.deposit_amount
            ? Math.max(0, Math.round((Number(i.amount) - Number(i.deposit_amount)) * 100) / 100)
            : "",
      },
      { header: "Status", value: (i) => i.status },
      { header: "Raised", value: (i) => date(i.created_at) },
      { header: "Sent", value: (i) => date(i.sent_at) },
      { header: "Due", value: (i) => date(i.due_date) },
      { header: "Paid", value: (i) => date(i.paid_at) },
    ])
  );

  zip.file(
    "job-notes.csv",
    toCsv(notes, [
      { header: "Client", value: (n) => customerForJob(n.job_id)?.name },
      { header: "Job", value: (n) => jobById.get(n.job_id)?.job_type },
      { header: "Note", value: (n) => n.note },
      { header: "Important", value: (n) => (n.important ? "yes" : "") },
      { header: "Added", value: (n) => dateTime(n.created_at) },
    ])
  );

  zip.file(
    "recurring-jobs.csv",
    toCsv(recurring, [
      { header: "Client", value: (r) => customerById.get(r.customer_id)?.name },
      { header: "Job", value: (r) => r.job_type },
      { header: "Amount", value: (r) => r.amount },
      { header: "Every", value: (r) => `${r.frequency_value} ${r.frequency_unit}` },
      { header: "Next", value: (r) => date(r.next_occurrence) },
      { header: "Active", value: (r) => (r.active ? "yes" : "paused") },
    ])
  );

  // Payment-chase history — the record of every reminder email sent for an
  // overdue invoice. Part of "everything" and evidence of what a homeowner
  // was told, so it belongs in the export.
  zip.file(
    "invoice-chases.csv",
    toCsv(chaseLog, [
      {
        header: "Invoice number",
        value: (c) => invoiceById.get(c.invoice_id)?.invoice_number,
      },
      {
        header: "Client",
        value: (c) => customerForJob(invoiceById.get(c.invoice_id)?.job_id)?.name,
      },
      { header: "Channel", value: (c) => c.channel },
      { header: "Sent", value: (c) => dateTime(c.sent_at) },
      { header: "Message", value: (c) => c.message },
    ])
  );

  // Every email the app sent on the business's behalf (quotes, bookings,
  // invoices, follow-ups, review requests - invoice chasers are in
  // invoice-chases.csv). email_log is service-role-only, so this read uses
  // the admin client scoped explicitly by business_id; the export is
  // already gated on canSeeEverything above.
  const { data: sentEmailRows } = await supabaseAdmin()
    .from("email_log")
    .select("kind, email_to, subject, sent_at, customer_id")
    .eq("business_id", currentMember.business_id)
    .order("sent_at");
  zip.file(
    "emails-sent.csv",
    toCsv(sentEmailRows, [
      { header: "Type", value: (e) => EMAIL_KIND_LABELS[e.kind] || e.kind },
      { header: "Client", value: (e) => customerById.get(e.customer_id)?.name },
      { header: "To", value: (e) => e.email_to },
      { header: "Subject", value: (e) => e.subject },
      { header: "Sent", value: (e) => dateTime(e.sent_at) },
    ])
  );

  // Personal calendar reminders.
  zip.file(
    "reminders.csv",
    toCsv(reminders, [
      { header: "Title", value: (r) => r.title },
      { header: "Notes", value: (r) => r.notes },
      { header: "Start", value: (r) => dateTime(r.scheduled_start) },
      { header: "End", value: (r) => dateTime(r.scheduled_end) },
      { header: "Created by", value: (r) => memberById.get(r.created_by)?.name },
      { header: "Created", value: (r) => date(r.created_at) },
    ])
  );

  // Customised email templates (quote, invoice, chase wording).
  zip.file(
    "email-templates.csv",
    toCsv(templates, [
      { header: "Template", value: (t) => t.key },
      { header: "Subject", value: (t) => t.subject },
      { header: "Body", value: (t) => t.body },
      { header: "Last edited", value: (t) => date(t.updated_at) },
    ])
  );

  // Team roster. Deliberately excludes password hashes and reset tokens -
  // this is a portability export, not a credential dump.
  zip.file(
    "team.csv",
    toCsv(team, [
      { header: "Name", value: (m) => m.name },
      { header: "Email", value: (m) => m.email },
      { header: "Role", value: (m) => m.role },
      { header: "Active", value: (m) => (m.is_active ? "yes" : "no")  },
      { header: "Can invoice", value: (m) => (m.can_invoice ? "yes" : "") },
      { header: "Can see clients", value: (m) => (m.can_see_client_database ? "yes" : "") },
      { header: "Added", value: (m) => date(m.created_at) },
    ])
  );

  // Business settings, as a readable text file rather than a one-row CSV.
  const settingsLines = [
    ["Business name", settings.business_name],
    ["Contact email", settings.contact_email],
    ["Contact phone", settings.contact_phone],
    ["Currency", settings.currency],
    ["Payment terms", settings.payment_terms],
    ["Bank details", settings.bank_details],
    ["Invoice note", settings.invoice_note],
    ["Header tagline", settings.header_tagline],
    ["Google review link", settings.google_review_link],
    ["Include weekends", settings.include_weekends ? "yes" : "no"],
    ["Send review requests", settings.send_review_requests ? "yes" : "no"],
  ]
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  zip.file("settings.txt", `${settings.business_name || "Your business"} settings\n\n${settingsLines}\n`);

  // ---- photos -------------------------------------------------------
  const photoList = photos || [];
  const paths = photoList.map((p) => p.storage_path).filter(Boolean);
  const signed = await signPaths("job-photos", paths, LINK_TTL);

  let bytesUsed = 0;
  let embedded = 0;
  const skipped = [];

  for (const photo of photoList) {
    const url = signed.get(photo.storage_path);
    if (!url) continue;

    const client = customerForJob(photo.job_id)?.name || "unknown-client";
    const safeClient = client.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "client";
    const ext = (photo.storage_path.split(".").pop() || "jpg").toLowerCase();
    const name = `photos/${safeClient}/${photo.label}-${date(photo.created_at)}-${photo.id.slice(0, 6)}.${ext}`;

    if (bytesUsed >= PHOTO_BYTE_BUDGET) {
      skipped.push({ photo, url, name });
      continue;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) { skipped.push({ photo, url, name }); continue; }
      const buf = await res.arrayBuffer();
      bytesUsed += buf.byteLength;
      zip.file(name, buf);
      embedded += 1;
    } catch (e) {
      console.error("Export: photo fetch failed", photo.storage_path, e.message);
      skipped.push({ photo, url, name });
    }
  }

  // ---- note images --------------------------------------------------
  // Photos attached to job notes live in a separate bucket and were left
  // out of the export entirely. Embed them under the same remaining budget,
  // into a note-images/ folder, and list them (with links for any skipped).
  const noteImageRows = (notes || []).filter((n) => n.image_storage_path);
  const notePaths = noteImageRows.map((n) => n.image_storage_path);
  const noteSigned = await signPaths("job-note-images", notePaths, LINK_TTL);
  const noteSkipped = [];
  let noteEmbedded = 0;

  for (const note of noteImageRows) {
    const url = noteSigned.get(note.image_storage_path);
    if (!url) continue;

    const client = customerForJob(note.job_id)?.name || "unknown-client";
    const safeClient = client.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "client";
    const ext = (note.image_storage_path.split(".").pop() || "jpg").toLowerCase();
    const name = `note-images/${safeClient}/note-${date(note.created_at)}-${note.id.slice(0, 6)}.${ext}`;

    if (bytesUsed >= PHOTO_BYTE_BUDGET) {
      noteSkipped.push({ note, url, name });
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) { noteSkipped.push({ note, url, name }); continue; }
      const buf = await res.arrayBuffer();
      bytesUsed += buf.byteLength;
      zip.file(name, buf);
      noteEmbedded += 1;
    } catch (e) {
      console.error("Export: note image fetch failed", note.image_storage_path, e.message);
      noteSkipped.push({ note, url, name });
    }
  }

  if (noteImageRows.length) {
    zip.file(
      "note-images.csv",
      toCsv(noteImageRows, [
        { header: "Client", value: (n) => customerForJob(n.job_id)?.name },
        { header: "Job", value: (n) => jobById.get(n.job_id)?.job_type },
        { header: "Note", value: (n) => n.note },
        { header: "Taken", value: (n) => date(n.created_at) },
        {
          header: "In this download",
          value: (n) => (noteSkipped.some((s) => s.note.id === n.id) ? "no - see link" : "yes"),
        },
        {
          header: "Link (expires in 7 days)",
          value: (n) => noteSkipped.find((s) => s.note.id === n.id)?.url || "",
        },
      ])
    );
  }

  zip.file(
    "photos.csv",
    toCsv(photoList, [
      { header: "Client", value: (p) => customerForJob(p.job_id)?.name },
      { header: "Job", value: (p) => jobById.get(p.job_id)?.job_type },
      { header: "Before/after", value: (p) => p.label },
      { header: "Taken", value: (p) => date(p.created_at) },
      {
        header: "In this download",
        value: (p) => (skipped.some((s) => s.photo.id === p.id) ? "no - see link" : "yes"),
      },
      {
        header: "Link (expires in 7 days)",
        value: (p) => skipped.find((s) => s.photo.id === p.id)?.url || "",
      },
    ])
  );

  const skippedNote = skipped.length
    ? `\n${skipped.length} photo(s) were too large to include in this download. They are\nlisted in photos.csv with a direct link each. Those links stop working\nafter 7 days, so save anything you need now.\n`
    : "";

  zip.file(
    "README.txt",
    `Export of ${settings.business_name || "your business"}\n` +
      `Created ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n\n` +
      `clients.csv         everyone on your books\n` +
      `jobs.csv            every job, with dates and status\n` +
      `quotes.csv          the jobs you quoted for, and what happened\n` +
      `invoices.csv        every invoice, with payment status and dates\n` +
      `invoice-chases.csv  the payment reminders sent for overdue invoices\n` +
      `emails-sent.csv     every other email sent for you (quotes, bookings, invoices)\n` +
      `job-notes.csv       notes recorded against jobs\n` +
      `note-images.csv     photos attached to notes, and whether they're here\n` +
      `recurring-jobs.csv  repeating work and its schedule\n` +
      `reminders.csv       your personal calendar reminders\n` +
      `email-templates.csv your customised quote/invoice/chase wording\n` +
      `team.csv            the people on your team and what they can do\n` +
      `settings.txt        your business settings\n` +
      `photos.csv          every job photo, and whether it's in this file\n` +
      `photos/             the job images, in a folder per client (${embedded} included)\n` +
      `note-images/        photos attached to notes (${noteEmbedded} included)\n` +
      skippedNote +
      `\nThe CSV files open in Excel, Numbers or Google Sheets.\n\n` +
      `Keep this safe. If you cancel your PatchUp account, everything here\n` +
      `is deleted from our systems 30 days later and cannot be recovered.\n` +
      `Your invoices are your own tax records - HMRC expects you to keep\n` +
      `them for six years.\n`
  );

  const blob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = (settings.business_name || "patchup").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}-export-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
