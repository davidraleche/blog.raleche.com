import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageTitle, Flash } from "@/components/admin/ui";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { sendCampaign, deleteCampaign } from "../../../actions";

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; test?: string; sent?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [c, audience] = await Promise.all([db.campaign.findUnique({ where: { id } }), db.subscriber.count({ where: { status: "subscribed" } })]);
  if (!c) notFound();
  return (
    <div>
      <PageTitle title="Campaign" sub={c.status === "sent" ? `Sent to ${c.sentCount} on ${c.sentAt?.toLocaleString()}` : `Draft · audience ${audience} subscribers`}>
        {c.status !== "sent" && (
          <>
            <form action={sendCampaign}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="test" value="1" /><button className="term-btn-ghost">Send test to me</button></form>
            <form action={sendCampaign}><input type="hidden" name="id" value={c.id} /><button className="term-btn">Send to {audience}</button></form>
          </>
        )}
        <form action={deleteCampaign}><input type="hidden" name="id" value={c.id} /><button className="term-btn-danger">Delete</button></form>
      </PageTitle>
      {sp.saved && <Flash>Draft saved.</Flash>}
      {sp.test && <Flash>Test email sent to your address.</Flash>}
      {sp.sent && <Flash>Campaign sent to {sp.sent} subscribers.</Flash>}
      <CampaignForm campaign={c} />
    </div>
  );
}
