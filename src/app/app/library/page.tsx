/* eslint-disable @next/next/no-img-element -- short-lived private Supabase signed URLs */

import Link from "next/link";
import { CalendarDays, Images, Search, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_PHOTO_BUCKET } from "@/lib/library/constants";
import { FeedbackToast } from "@/components/feedback-provider";

type DateFilter = "all" | "today" | "7d" | "30d";
type SortOrder = "newest" | "oldest" | "name";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; date?: string; sort?: string }> }) {
  const params = await searchParams;
  const search = (params.q ?? "").trim().slice(0, 100);
  const dateFilter: DateFilter = ["today", "7d", "30d"].includes(params.date ?? "") ? params.date as DateFilter : "all";
  const sortOrder: SortOrder = ["oldest", "name"].includes(params.sort ?? "") ? params.sort as SortOrder : "newest";
  const supabase = await createClient();
  let query = supabase.from("customers").select("id, full_name, updated_at, photos(count)").order("updated_at", { ascending: false }).limit(100);
  if (search) query = query.ilike("full_name", `%${escapeLike(search)}%`);
  const { data: customers, error } = await query;
  const customerIds = (customers ?? []).map((customer) => customer.id);
  const { data: photos } = customerIds.length
    ? await supabase.from("photos").select("customer_id, storage_path, created_at").in("customer_id", customerIds).order("created_at", { ascending: false })
    : { data: [] };

  const coverPathByCustomer = new Map<string, string>();
  const latestUploadByCustomer = new Map<string, string>();
  for (const photo of photos ?? []) {
    if (!coverPathByCustomer.has(photo.customer_id)) {
      coverPathByCustomer.set(photo.customer_id, photo.storage_path);
      latestUploadByCustomer.set(photo.customer_id, photo.created_at);
    }
  }

  const filteredCustomers = (customers ?? []).filter((customer) => {
    if (dateFilter === "all") return true;
    const uploadedAt = latestUploadByCustomer.get(customer.id);
    return uploadedAt ? new Date(uploadedAt).getTime() >= dateThreshold(dateFilter) : false;
  }).sort((first, second) => {
    if (sortOrder === "name") return first.full_name.localeCompare(second.full_name);
    const firstTime = new Date(latestUploadByCustomer.get(first.id) ?? 0).getTime();
    const secondTime = new Date(latestUploadByCustomer.get(second.id) ?? 0).getTime();
    return sortOrder === "oldest" ? firstTime - secondTime : secondTime - firstTime;
  });

  const coverPaths = filteredCustomers.flatMap((customer) => {
    const path = coverPathByCustomer.get(customer.id);
    return path ? [path] : [];
  });
  const { data: signedCovers } = coverPaths.length
    ? await supabase.storage.from(CUSTOMER_PHOTO_BUCKET).createSignedUrls(coverPaths, 3600)
    : { data: [] };
  const signedUrlByPath = new Map((signedCovers ?? []).map((item) => [item.path, item.signedUrl]));
  const customerCount = filteredCustomers.length;
  const photoCount = filteredCustomers.reduce((total, customer) => total + (customer.photos?.[0]?.count ?? 0), 0);

  return <div>
    <div className="border-b border-[var(--border-soft)] bg-white px-4 py-3">
      <form className="flex flex-wrap items-end gap-2">
        <label className="relative min-w-[230px] flex-1 sm:max-w-[390px]"><span className="sr-only">Search customer name</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" /><input name="q" defaultValue={search} placeholder="Search customer name..." className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-9 pr-3" /></label>
        <label><span className="sr-only">Filter by upload date</span><select name="date" defaultValue={dateFilter} className="h-10 min-w-[145px] rounded-lg border border-[var(--border)] bg-white px-3 font-semibold"><option value="all">All upload dates</option><option value="today">Uploaded today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option></select></label>
        <label><span className="sr-only">Sort gallery</span><select name="sort" defaultValue={sortOrder} className="h-10 min-w-[130px] rounded-lg border border-[var(--border)] bg-white px-3 font-semibold"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label>
        <button className="flex h-10 items-center gap-2 rounded-lg bg-[var(--brand)] px-3.5 font-bold"><CalendarDays size={15} /> Apply</button>
        {(search || dateFilter !== "all" || sortOrder !== "newest") && <Link href="/app/library" className="grid h-10 place-items-center rounded-lg px-3 font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-warm)]">Clear</Link>}
        <span className="ml-auto pb-2 text-[11.5px] text-[var(--ink-3)]">{customerCount} customer{customerCount === 1 ? "" : "s"} · {photoCount} saved photo{photoCount === 1 ? "" : "s"}</span>
      </form>
    </div>

    <div className="p-5 sm:p-6">
      {error ? <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white"><Empty title="Could not load customers" body="Check the Supabase migration and your internet connection." /></div>
        : filteredCustomers.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">{filteredCustomers.map((customer) => {
          const count = customer.photos?.[0]?.count ?? 0;
          const coverPath = coverPathByCustomer.get(customer.id);
          const coverUrl = coverPath ? signedUrlByPath.get(coverPath) : null;
          const uploadedAt = latestUploadByCustomer.get(customer.id);
          return <Link key={customer.id} href={`/app/library/${customer.id}`} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--ground)] transition hover:-translate-y-0.5 hover:border-[#d5c56f] hover:shadow-[0_7px_20px_rgba(23,23,23,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]">
            {coverUrl ? <img src={coverUrl} alt={`${customer.full_name} customer photo`} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]" /> : <div className="grid h-full place-items-center text-[var(--ink-3)]"><div className="text-center"><UserRound className="mx-auto" size={30} /><span className="mt-2 block text-[11px]">No photo yet</span></div></div>}
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[rgba(23,23,23,.75)] px-2 py-1 text-[10px] font-bold text-white"><Images size={11} /> {count}</span>
            <span className="absolute inset-x-0 bottom-0 block bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-12 text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100"><strong className="block truncate text-[14px]">{customer.full_name}</strong><span className="mt-1 block text-[10.5px] text-white/80">{uploadedAt ? `Uploaded ${formatDate(uploadedAt)}` : "No uploads yet"}</span></span>
          </Link>;
        })}</div>
          : <div className="overflow-hidden rounded-xl border border-[var(--border-soft)] bg-white"><Empty title={search || dateFilter !== "all" ? "No matching uploads" : "No customers saved yet"} body={search || dateFilter !== "all" ? "Try a different name or a wider upload-date range." : "Create a customer, then add one or more private photos."} /></div>}
    </div>
  </div>;
}

function dateThreshold(filter: Exclude<DateFilter, "all">) {
  const now = new Date();
  if (filter === "today") {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  return Date.now() - (filter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value));
}

function escapeLike(value: string) { return value.replace(/[\\%_]/g, (character) => `\\${character}`); }
function Empty({ title, body }: { title: string; body: string }) { return <>{title === "Could not load customers" && <FeedbackToast message="Could not load customers. Check the internet connection and Supabase setup." />}<div className="grid min-h-[300px] place-items-center px-6 py-12 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--divider)]"><Search size={19} /></span><p className="mt-4 text-[16px] font-bold">{title}</p><p className="mt-2 text-[13px] text-[var(--ink-2)]">{body}</p></div></div></>; }
