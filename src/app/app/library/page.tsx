/* eslint-disable @next/next/no-img-element -- short-lived private Supabase signed URLs */

import Link from "next/link";
import { Images, Search, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_PHOTO_BUCKET } from "@/lib/library/constants";
import { FeedbackToast } from "@/components/feedback-provider";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const search = q.trim().slice(0, 100);
  const supabase = await createClient();
  let query = supabase.from("customers").select("id, full_name, notes, updated_at, photos(count)").order("updated_at", { ascending: false }).limit(100);
  if (search) query = query.ilike("full_name", `%${escapeLike(search)}%`);
  const { data: customers, error } = await query;
  const customerIds = (customers ?? []).map((customer) => customer.id);
  const { data: photos } = customerIds.length
    ? await supabase.from("photos").select("customer_id, storage_path, created_at").in("customer_id", customerIds).order("created_at", { ascending: false })
    : { data: [] };
  const coverPathByCustomer = new Map<string, string>();
  for (const photo of photos ?? []) {
    if (!coverPathByCustomer.has(photo.customer_id)) coverPathByCustomer.set(photo.customer_id, photo.storage_path);
  }
  const coverPaths = Array.from(coverPathByCustomer.values());
  const { data: signedCovers } = coverPaths.length
    ? await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).createSignedUrls(coverPaths, 3600)
    : { data: [] };
  const signedUrlByPath = new Map((signedCovers ?? []).map((item) => [item.path, item.signedUrl]));
  const customerCount = customers?.length ?? 0;
  const photoCount = (customers ?? []).reduce((total, customer) => total + (customer.photos?.[0]?.count ?? 0), 0);

  return <div><div className="flex min-h-[62px] flex-wrap items-center gap-3 border-b border-[var(--border-soft)] bg-white px-4 py-2.5"><form className="relative w-full max-w-[390px]"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" /><input name="q" defaultValue={search} placeholder="Search customer name..." className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3" /></form><span className="text-[11.5px] text-[var(--ink-3)]">{customerCount} customer{customerCount === 1 ? "" : "s"} · {photoCount} saved photo{photoCount === 1 ? "" : "s"}</span></div><div className="p-5 sm:p-6">{error ? <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white"><Empty title="Could not load customers" body="Check the Supabase migration and your internet connection." /></div> : customers?.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{customers.map((customer) => { const count = customer.photos?.[0]?.count ?? 0; const coverPath = coverPathByCustomer.get(customer.id); const coverUrl = coverPath ? signedUrlByPath.get(coverPath) : null; return <Link key={customer.id} href={`/app/library/${customer.id}`} className="group overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white transition hover:-translate-y-0.5 hover:border-[#d5c56f] hover:shadow-[0_5px_16px_rgba(23,23,23,.08)]"><div className="relative aspect-[4/3] overflow-hidden bg-[var(--ground)]">{coverUrl ? <img src={coverUrl} alt={`${customer.full_name} customer photo`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center text-[var(--ink-3)]"><div className="text-center"><UserRound className="mx-auto" size={30} /><span className="mt-2 block text-[11px]">No photo yet</span></div></div>}<span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[rgba(23,23,23,.75)] px-2 py-1 text-[10px] font-bold text-white"><Images size={11} /> {count}</span></div><div className="p-3"><strong className="block truncate text-[14px]">{customer.full_name}</strong><p className="mt-1 truncate text-[11.5px] text-[var(--ink-3)]">{customer.notes || (count === 1 ? "1 saved photo" : `${count} saved photos`)}</p></div></Link>; })}</div> : <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white"><Empty title={search ? "No matching customers" : "No customers saved yet"} body={search ? "Try a shorter name or browse the gallery by face." : "Create a customer, then add one or more private photos."} /></div>}</div></div>;
}

function escapeLike(value: string) { return value.replace(/[\\%_]/g, (character) => `\\${character}`); }
function Empty({ title, body }: { title: string; body: string }) { return <>{title === "Could not load customers" && <FeedbackToast message="Could not load customers. Check the internet connection and Supabase setup." />}<div className="grid min-h-[300px] place-items-center px-6 py-12 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--divider)]"><Search size={19} /></span><p className="mt-4 text-[16px] font-bold">{title}</p><p className="mt-2 text-[13px] text-[var(--ink-2)]">{body}</p></div></div></>; }
