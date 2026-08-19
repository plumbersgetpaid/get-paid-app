// Tenant isolation test.
//
// Creates three throwaway businesses with distinguishable data, mints a
// real session for each owner, then has every business try to reach every
// other business's data - by id, through the list screens, and through
// the mutation endpoints. Cleans up after itself.
//
//   node --env-file=.env.local scripts/isolation-test.mjs [baseUrl]
//
// Defaults to http://localhost:3000. Pass a URL to run against a deploy.
//
// Written as a script rather than a click-through because the interesting
// failures aren't visible on screen: the two real leaks found in Aug 2026
// were an email sent by a cron and a storage URL that never touched the
// app at all.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const BASE = process.argv[2] || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ---------- session minting (mirrors lib/auth.js) ----------
const enc = new TextEncoder();
async function signSession(teamMemberId) {
  const expires = Date.now() + 60 * 60 * 1000;
  const payload = `${teamMemberId}.${expires}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(process.env.SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${hex}`;
}

// ---------- results ----------
const results = [];
const record = (area, detail, passed, note = "") => results.push({ area, detail, passed, note });

// ---------- seed ----------
const TAG = `ZZISO-${Date.now().toString(36)}`;
const tenants = [];

async function seedTenant(label) {
  const bid = randomUUID();
  const marker = `${TAG}-${label}`;
  await db.from("businesses").insert({ id: bid, name: `${marker} Plumbing` });
  await db.from("subscriptions").insert({
    business_id: bid, status: "active", stripe_customer_id: `cus_${marker}`,
  });
  const { data: owner } = await db.from("team_members").insert({
    business_id: bid, name: `${marker} Owner`, email: `${marker.toLowerCase()}@example.test`,
    password_hash: "test-only-not-a-real-hash", role: "owner", is_active: true,
  }).select().single();

  const { data: customer } = await db.from("customers").insert({
    business_id: bid, name: `${marker}-CLIENT`, phone: "07000000000",
    email: `${marker.toLowerCase()}-client@example.test`, address: `${marker} Street`,
  }).select().single();

  const { data: job } = await db.from("jobs").insert({
    business_id: bid, customer_id: customer.id, job_type: `${marker}-JOB`,
    amount: 123, status: "invoiced", created_by: owner.id,
    location: `${marker} Road`, completion_note: `${marker}-NOTE-TEXT`,
  }).select().single();

  // A scheduled, in-progress job for tomorrow: this is what the field
  // pack endpoint serves, so it's what a field-pack leak would expose.
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  await db.from("jobs").insert({
    business_id: bid, customer_id: customer.id, job_type: `${marker}-FIELDJOB`,
    amount: 5, status: "in_progress", time_confirmed: true, created_by: owner.id,
    scheduled_start: `${tomorrow}T09:00:00Z`, scheduled_end: `${tomorrow}T10:00:00Z`,
  });

  const { data: invoice } = await db.from("invoices").insert({
    business_id: bid, job_id: job.id, amount: 123, status: "unpaid",
    due_date: new Date().toISOString().slice(0, 10),
  }).select().single();

  const { data: note } = await db.from("job_notes").insert({
    business_id: bid, job_id: job.id, note: `${marker}-PRIVATE-NOTE`, created_by: owner.id,
  }).select().single();

  const { data: recurring } = await db.from("recurring_jobs").insert({
    business_id: bid, customer_id: customer.id, job_type: `${marker}-RECURRING`,
    amount: 50, frequency_value: 1, frequency_unit: "months",
    next_occurrence: new Date().toISOString().slice(0, 10), created_by: owner.id, active: true,
  }).select().single();

  const { data: photo } = await db.from("job_photos").insert({
    business_id: bid, job_id: job.id, storage_path: `${job.id}/before-iso-test.jpg`, label: "before",
  }).select().single();

  const cookie = `gp_session=${await signSession(owner.id)}`;
  return { label, marker, bid, ownerId: owner.id, customer, job, invoice, note, recurring, photo, cookie };
}

// ---------- probes ----------
async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, body };
}

async function post(path, cookie, form) {
  const body = new URLSearchParams(form);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
    body, redirect: "manual",
  });
  return { status: res.status };
}

async function run() {
  console.log(`isolation test against ${BASE}\n`);
  console.log("seeding three businesses...");
  for (const label of ["ALPHA", "BETA", "GAMMA"]) tenants.push(await seedTenant(label));
  console.log(`  ${tenants.map((t) => t.marker).join(", ")}\n`);

  // 0. CONTROL: each tenant must be able to see its OWN data.
  //
  // Without this the whole run is worthless - if session minting were
  // broken every request would redirect to /login, nothing would contain
  // anyone's marker, and all the isolation checks would "pass" while
  // proving nothing at all. A test that cannot fail is not a test.
  for (const t of tenants) {
    const { status, body } = await get(`/jobs/view/${t.job.id}`, t.cookie);
    record("CONTROL", `${t.label} can see its own job`, status === 200 && body.includes(t.marker),
      status === 200 ? (body.includes(t.marker) ? "200, marker present" : "200 but marker MISSING") : `HTTP ${status}`);

    const clients = await get("/clients", t.cookie);
    record("CONTROL", `${t.label} can see its own client list`,
      clients.status === 200 && clients.body.includes(t.marker),
      clients.status === 200 ? (clients.body.includes(t.marker) ? "200, marker present" : "200 but marker MISSING") : `HTTP ${clients.status}`);
  }

  // 1. direct access to another tenant's resources by id
  const byIdRoutes = (t) => [
    [`/jobs/view/${t.job.id}`, t.marker],
    [`/invoices/${t.invoice.id}`, t.marker],
    [`/clients/${t.customer.id}`, t.marker],
    [`/clients/${t.customer.id}/edit`, t.marker],
    [`/jobs/photos/${t.job.id}`, t.marker],
    [`/jobs/notes/${t.job.id}`, t.marker],
    [`/jobs/complete/${t.job.id}`, t.marker],
    [`/jobs/schedule/${t.job.id}`, t.marker],
    [`/jobs/recurring/${t.recurring.id}/edit`, t.marker],
    [`/settings/team/${t.ownerId}`, t.marker],
  ];

  for (const viewer of tenants) {
    for (const target of tenants) {
      if (viewer.bid === target.bid) continue;
      for (const [path, marker] of byIdRoutes(target)) {
        const { status, body } = await get(path, viewer.cookie);
        const leaked = status === 200 && body.includes(marker);
        record("direct id", `${viewer.label} -> ${target.label} ${path.replace(/[0-9a-f-]{36}/g, ":id")}`,
          !leaked, leaked ? `HTTP 200 containing ${marker}` : `HTTP ${status}`);
      }
    }
  }

  // 2. list screens must not contain anyone else's data
  const listRoutes = ["/", "/work", "/clients", "/invoices", "/jobs", "/jobs/recurring", "/calendar", "/settings/team"];
  for (const viewer of tenants) {
    for (const path of listRoutes) {
      const { status, body } = await get(path, viewer.cookie);
      const others = tenants.filter((t) => t.bid !== viewer.bid);
      const found = others.filter((o) => body.includes(o.marker)).map((o) => o.label);
      record("list screen", `${viewer.label} sees ${path}`, found.length === 0,
        found.length ? `contains ${found.join(",")}` : `HTTP ${status}, clean`);
    }
  }

  // 3. mutation endpoints must refuse another tenant's ids - and the row
  //    must still be there afterwards, which is the part that matters
  for (const actor of tenants) {
    for (const target of tenants) {
      if (actor.bid === target.bid) continue;

      await post("/api/jobs/delete", actor.cookie, { jobId: target.job.id });
      const { count: jobLeft } = await db.from("jobs").select("*", { count: "exact", head: true }).eq("id", target.job.id);
      record("mutation", `${actor.label} -> delete ${target.label}'s job`, jobLeft === 1,
        jobLeft === 1 ? "job intact" : "JOB WAS DELETED");

      await post("/api/invoices/mark-paid", actor.cookie, { invoiceId: target.invoice.id });
      const { data: inv } = await db.from("invoices").select("status").eq("id", target.invoice.id).maybeSingle();
      record("mutation", `${actor.label} -> mark ${target.label}'s invoice paid`, inv?.status === "unpaid",
        inv?.status === "unpaid" ? "still unpaid" : `status became ${inv?.status}`);

      await post("/api/clients/delete", actor.cookie, { customerId: target.customer.id });
      const { count: custLeft } = await db.from("customers").select("*", { count: "exact", head: true }).eq("id", target.customer.id);
      record("mutation", `${actor.label} -> delete ${target.label}'s client`, custLeft === 1,
        custLeft === 1 ? "client intact" : "CLIENT WAS DELETED");

      await post("/api/jobs/recurring/delete", actor.cookie, { recurringId: target.recurring.id });
      const { count: recLeft } = await db.from("recurring_jobs").select("*", { count: "exact", head: true }).eq("id", target.recurring.id);
      record("mutation", `${actor.label} -> delete ${target.label}'s recurring job`, recLeft === 1,
        recLeft === 1 ? "intact" : "WAS DELETED");
    }
  }

  // 4. notes API returns JSON rather than a page - check it separately
  for (const actor of tenants) {
    for (const target of tenants) {
      if (actor.bid === target.bid) continue;
      const res = await fetch(`${BASE}/api/jobs/notes/list?jobId=${target.job.id}`, { headers: { cookie: actor.cookie } });
      const text = await res.text();
      const leaked = res.status === 200 && text.includes(`${target.marker}-PRIVATE-NOTE`);
      record("api json", `${actor.label} -> ${target.label}'s notes`, !leaked,
        leaked ? "LEAKED note text" : `HTTP ${res.status}`);
    }
  }

  // 4b. the field pack must contain the viewer's own field job and no one
  //     else's - it's the offline copy of the diary, so a leak here would
  //     persist on the wrong person's device.
  for (const viewer of tenants) {
    const res = await fetch(`${BASE}/api/field-pack`, { headers: { cookie: viewer.cookie } });
    const body = res.status === 200 ? await res.text() : "";
    record("field pack", `${viewer.label} pack contains own job`,
      body.includes(`${viewer.marker}-FIELDJOB`),
      body.includes(`${viewer.marker}-FIELDJOB`) ? "own job present" : `HTTP ${res.status}, own job MISSING`);
    for (const other of tenants) {
      if (other.bid === viewer.bid) continue;
      record("field pack", `${viewer.label} pack free of ${other.label}`,
        !body.includes(other.marker),
        body.includes(other.marker) ? "CONTAINS OTHER TENANT" : "clean");
    }
  }

  // 5. storage - a photo path belonging to another tenant must not be
  //    fetchable without a signature
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  for (const t of tenants) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-photos/${t.job.id}/before-iso-test.jpg`;
    const res = await fetch(url);
    record("storage", `unsigned public URL for ${t.label}'s photo`, res.status !== 200, `HTTP ${res.status}`);

    const { error } = await anon.storage.from("job-photos").createSignedUrl(`${t.job.id}/before-iso-test.jpg`, 60);
    record("storage", `anon key can sign ${t.label}'s photo`, !!error, error ? "refused" : "SIGNED - anon key can mint links");
  }

  // ---------- report ----------
  const failed = results.filter((r) => !r.passed);
  const byArea = {};
  for (const r of results) {
    byArea[r.area] ??= { pass: 0, fail: 0 };
    byArea[r.area][r.passed ? "pass" : "fail"] += 1;
  }

  console.log("results by area:");
  for (const [area, c] of Object.entries(byArea)) {
    console.log(`  ${area.padEnd(12)} ${String(c.pass).padStart(3)} passed  ${c.fail ? `${c.fail} FAILED` : ""}`);
  }

  if (failed.length) {
    console.log(`\n${failed.length} FAILURES:`);
    for (const f of failed) console.log(`  [${f.area}] ${f.detail}\n      ${f.note}`);
  } else {
    console.log(`\nall ${results.length} checks passed - no cross-tenant access found`);
  }

  // ---------- cleanup ----------
  console.log("\ncleaning up...");
  for (const t of tenants) {
    await db.from("subscriptions").update({ status: "canceled" }).eq("business_id", t.bid);
    const { error } = await db.rpc("delete_business_data", { p_business_id: t.bid });
    if (error) console.log(`  cleanup failed for ${t.label}: ${error.message}`);
    await db.from("subscriptions").delete().eq("business_id", t.bid);
    await db.from("businesses").delete().eq("id", t.bid);
  }
  console.log("done");

  process.exit(failed.length ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
