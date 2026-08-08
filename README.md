# Get Paid — Setup Guide

This is your v1 app: add a job, mark it done, it auto-invoices the customer,
and chases them automatically if they don't pay. This guide assumes zero
coding experience — just follow the steps in order.

## What you'll need to sign up for (all free to start)

1. **GitHub** (github.com) — free. This is where your code lives.
2. **Vercel** (vercel.com) — free tier. This is what makes your app live on the internet.
3. **Supabase** (supabase.com) — free tier. This is your database.
4. **Resend** (resend.com) — free tier (3,000 emails/month). This sends the invoice emails.
5. *(Later, optional for v1)* **Twilio** (twilio.com) — for SMS/WhatsApp chasing.

---

## Step 1: Get the code online (GitHub)

1. Create a free GitHub account if you don't have one.
2. Create a new repository (call it `get-paid-app`).
3. Upload all the files I've given you into that repository
   (GitHub's website lets you drag-and-drop files to upload — no command
   line needed).

## Step 2: Set up your database (Supabase)

1. Create a free Supabase account, then click "New Project."
2. Once it's created, go to the **SQL Editor** tab.
3. Open the file `supabase/schema.sql` from your project, copy everything
   in it, paste it into the SQL Editor, and click **Run**.
   This creates all your tables (customers, jobs, invoices, chase log).
4. Go to **Project Settings → API**. You'll see:
   - `Project URL` → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_ROLE_KEY`
     (keep this one secret — never share it publicly)

## Step 3: Set up email sending (Resend)

1. Create a free Resend account.
2. Go to **API Keys** and create one — this is your `RESEND_API_KEY`.
3. Go to **Domains** and add your own domain if you have one (e.g.
   `yourbusiness.com`) so invoices come from your business, not a generic
   address. You can skip this step at first and use Resend's test sending
   while you're testing — just note real customers won't receive those.

## Step 4: Deploy the app (Vercel)

1. Create a free Vercel account and connect it to your GitHub account.
2. Click "New Project" and select the `get-paid-app` repository you
   uploaded.
3. Before deploying, Vercel will ask for **Environment Variables**. Enter
   every value from `.env.example`, using the real values you collected in
   Steps 2 and 3.
4. Click **Deploy**. After a minute or two, you'll get a live web address
   (like `get-paid-app.vercel.app`) — that's your working app.
5. Vercel will automatically run the daily "chase overdue invoices" job
   for you (already configured in `vercel.json`) — no extra setup needed.

## Step 5: Try it yourself first

1. Open your live app link on your phone.
2. Add a test job using your own name and email.
3. Mark it "done" and confirm you receive the invoice email.
4. This is the moment to catch anything that looks unprofessional before
   a real customer ever sees it.

## Step 6: Get your first real plumber using it

Once it works end-to-end for you, this is ready for a real plumber (even
you, if you're field-testing it yourself, or a friend/contact in the
trade) to try on real jobs.

---

## What's intentionally NOT built yet (by design)

- SMS/WhatsApp chasing (email-only for now — add Twilio later once email
  chasing is proven to work)
- Login / multiple plumber accounts (v1 is single-business only)
- Payment links (customers pay by bank transfer for now; Stripe/GoCardless
  can be added once this core loop is proven)
- Quoting, scheduling, dashboards — deliberately left out. See our
  conversation for why: prove this works first.

## If you get stuck

The most common hiccups are: pasting an environment variable with extra
spaces, forgetting to run the SQL schema before deploying, or the Resend
sending domain not being verified yet (emails will silently fail to send
until it is). Come back here and tell me exactly what error you're
seeing — I can help debug it.
