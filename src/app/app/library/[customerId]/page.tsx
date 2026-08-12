import { PageHeading } from "@/components/page-heading";

export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  return <div className="p-5 sm:p-8 lg:p-10"><PageHeading eyebrow="Customer record" title="Customer photos" description={`Private customer record ${customerId}. Data access is implemented in milestone 4.`} /></div>;
}
