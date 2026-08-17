import Link from "next/link";
import BackButton from "../../components/BackButton";
import { getBusinessSettings } from "../../lib/getBusinessSettings";
import { getCurrentTeamMember } from "../../lib/auth";
import { canCreateJob } from "../../lib/permissions";
import { getScopedDb } from "../../lib/scopedSupabaseClient";
import { notFound } from "next/navigation";
import MultiAssignField from "../../components/MultiAssignField";
import VoiceQuickBookAssist from "./VoiceQuickBookAssist";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function QuickBook({ searchParams }) {
  const currentMember = await getCurrentTeamMember();
  if (!canCreateJob(currentMember)) {
    notFound();
  }

  const db = await getScopedDb(currentMember);
  const { data: teamMembersData } = await db
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name");
  const teamMembers = teamMembersData || [];

  const settings = await getBusinessSettings();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const initialCustomerName = searchParams?.customerName || "";
  const initialPhone = searchParams?.phone || "";
  const initialEmail = searchParams?.email || "";
  const initialJobType = searchParams?.jobType || "";
  const initialAmount = searchParams?.amount || "";
  const initialDate = searchParams?.startDate || defaultDate;
  const initialTime = searchParams?.startTime || "09:00";
  const initialDuration = searchParams?.durationValue || "2";
  const initialDurationUnit = searchParams?.durationUnit || "hours";
  const initialLocation = searchParams?.location || "";
  const initialIncludeWeekends =
    searchParams?.includeWeekends !== undefined
      ? searchParams.includeWeekends === "1"
      : true;
  const conflictMessage = searchParams?.conflict;

  return (
    <main>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BackButton fallbackHref="/calendar" />
        <h1 style={{ fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>Quick book</h1>
      </div>

      <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
        For booking something in on the spot - no quote needed. You can
        invoice it properly later from "Jobs in progress."
      </p>

      {conflictMessage && (
        <div style={warningBoxStyle}>
          {conflictMessage} You can still book it in anyway if that's fine.
        </div>
      )}

      <form
        action="/api/calendar/quick-book"
        method="POST"
        style={{ display: "grid", gap: 12, marginTop: 16 }}
      >
        {conflictMessage && <input type="hidden" name="force" value="1" />}

        <VoiceQuickBookAssist
          initialCustomerName={initialCustomerName}
          initialPhone={initialPhone}
          initialEmail={initialEmail}
          initialJobType={initialJobType}
          initialAmount={initialAmount}
          initialDate={initialDate}
          initialTime={initialTime}
          initialDuration={initialDuration}
          initialDurationUnit={initialDurationUnit}
        />

        <input
          name="location"
          placeholder="Job location / address (optional)"
          defaultValue={initialLocation}
          style={inputStyle}
        />

        <label style={{ fontSize: 13, color: "#666" }}>
          Assign to
          <div style={{ marginTop: 6 }}>
            <MultiAssignField teamMembers={teamMembers} />
          </div>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            background: "white",
            padding: 12,
            borderRadius: 2,
          }}
        >
          <input
            type="checkbox"
            name="includeWeekends"
            value="1"
            defaultChecked={initialIncludeWeekends}
          />
          Include weekends for this booking
          <span style={{ color: "#888", fontSize: 12 }}>
            (off = working days only)
          </span>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: "#666", fontWeight: 500 }}>
            Let the client know (if you add their email above)
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="notifyEmail" value="1" defaultChecked />
            Email
          </label>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <Link href="/calendar" style={cancelButtonStyle}>
            Cancel
          </Link>
          <button type="submit" style={submitButtonStyle}>
            {conflictMessage ? "Book anyway" : "Book it in"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputStyle = {
  padding: "12px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontSize: 15,
  width: "100%",
  boxSizing: "border-box",
};

const warningBoxStyle = {
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 2,
  fontSize: 13,
  marginTop: 12,
};

const cancelButtonStyle = {
  background: "white",
  color: "#000",
  padding: "14px",
  borderRadius: 2,
  border: "1px solid #e2e2e2",
  fontWeight: 500,
  flex: 1,
  textAlign: "center",
  textDecoration: "none",
};

const submitButtonStyle = {
  background: "#16a34a",
  color: "white",
  padding: "14px",
  borderRadius: 2,
  border: "none",
  fontWeight: 500,
  flex: 2,
};
