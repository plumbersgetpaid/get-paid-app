import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { supabaseAdmin } from "../../lib/supabaseClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function RlsTest() {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  let scopedResult = null;
  let scopedError = null;
  try {
    const scopedDb = await getScopedDb(currentMember);
    const { data, error } = await scopedDb.from("customers").select("id, name, business_id");
    scopedResult = data;
    scopedError = error;
  } catch (err) {
    scopedError = { message: err.message };
  }

  const adminDb = supabaseAdmin();
  const { data: adminResult, error: adminError } = await adminDb
    .from("customers")
    .select("id, name, business_id");

  return (
    <main>
      <h1 style={{ fontSize: 18 }}>RLS diagnostic - temporary page</h1>

      <p style={{ fontSize: 13, color: "#888" }}>
        Your own business_id: <strong>{currentMember.business_id}</strong>
      </p>

      <h2 style={{ fontSize: 15, marginTop: 20 }}>
        Via the scoped client (should only show your own business's customers)
      </h2>
      {scopedError && (
        <pre style={{ background: "#fee2e2", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>
          ERROR: {JSON.stringify(scopedError, null, 2)}
        </pre>
      )}
      <p>Row count: {scopedResult ? scopedResult.length : "N/A"}</p>
      <pre style={{ background: "#f3f3f3", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>
        {JSON.stringify(scopedResult, null, 2)}
      </pre>

      <h2 style={{ fontSize: 15, marginTop: 20 }}>
        Via the existing service-role client (should show every customer, unfiltered - for comparison only)
      </h2>
      {adminError && (
        <pre style={{ background: "#fee2e2", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>
          ERROR: {JSON.stringify(adminError, null, 2)}
        </pre>
      )}
      <p>Row count: {adminResult ? adminResult.length : "N/A"}</p>
    </main>
  );
}
