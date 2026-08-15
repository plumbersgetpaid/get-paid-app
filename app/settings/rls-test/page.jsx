import { getCurrentTeamMember } from "../../lib/auth";
import { canSeeEverything } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { supabaseAdmin } from "../../lib/supabaseClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const TEST_BUSINESS_B_ID = "00000000-0000-0000-0000-000000000002";

export default async function RlsTest() {
  const currentMember = await getCurrentTeamMember();
  if (!canSeeEverything(currentMember)) {
    notFound();
  }

  async function runScoped(label, fakeMember) {
    try {
      const scopedDb = await getScopedDb(fakeMember);
      const { data, error } = await scopedDb.from("customers").select("id, name, business_id");
      return { label, data, error };
    } catch (err) {
      return { label, data: null, error: { message: err.message } };
    }
  }

  const asBlaise = await runScoped("As Blaise's business", currentMember);
  const asBusinessB = await runScoped("As the fake test business", {
    id: currentMember.id,
    business_id: TEST_BUSINESS_B_ID,
  });

  const adminDb = supabaseAdmin();
  const { data: adminResult } = await adminDb.from("customers").select("id, name, business_id");

  function renderResult(result) {
    return (
      <div style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 15 }}>{result.label}</h2>
        {result.error && (
          <pre style={{ background: "#fee2e2", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>
            ERROR: {JSON.stringify(result.error, null, 2)}
          </pre>
        )}
        <p>Row count: {result.data ? result.data.length : "N/A"}</p>
        <pre style={{ background: "#f3f3f3", padding: 12, borderRadius: 8, whiteSpace: "pre-wrap" }}>
          {JSON.stringify(result.data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <main>
      <h1 style={{ fontSize: 18 }}>RLS diagnostic - temporary page</h1>

      <p style={{ fontSize: 13, color: "#888" }}>
        Total customers across every business (unfiltered, via service role): <strong>{adminResult?.length}</strong>
      </p>

      {renderResult(asBlaise)}
      {renderResult(asBusinessB)}

      <p style={{ fontSize: 13, color: "#888", marginTop: 16 }}>
        Real isolation looks like: Blaise's count stays exactly what it
        was before ({adminResult ? adminResult.length - 1 : "?"} - the
        one new test row must NOT appear here), and the fake business
        shows exactly 1 - the one row created for it, nothing of
        Blaise's. If either count is wrong, isolation isn't actually
        working yet, whatever the earlier test showed.
      </p>
    </main>
  );
}
