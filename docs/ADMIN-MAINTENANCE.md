# Admin maintenance and backups

PhotoDesk exposes `/app/admin` only to an authenticated, active profile whose role is `admin`. Staff users are redirected to the Template Builder. The page performs read-only database checks and can download a metadata JSON export.

## What the in-app export contains

- Customer records and notes
- Photo records, filenames, variants, and private Storage paths
- Export timestamp and format version

It does **not** contain Auth accounts, password data, database schema, RLS policies, or the private image files stored in Supabase Storage. Treat it as an audit/troubleshooting export, not disaster recovery.

## Database backup

Use Supabase's managed backups when they are available for the project plan. For a manual backup, run the Supabase CLI from a trusted administrator computer. Keep the direct database URL in a temporary PowerShell environment variable and never in `.env.local` or a `NEXT_PUBLIC_*` variable.

```powershell
$env:CJNET_SUPABASE_DB_URL = "postgresql://postgres.PROJECT_REF:PASSWORD@HOST:5432/postgres"
npx supabase db dump --db-url $env:CJNET_SUPABASE_DB_URL -f "CJNET-PhotoDesk-schema-and-data.sql"
Remove-Item Env:CJNET_SUPABASE_DB_URL
```

Store the resulting SQL file in CJNET's access-controlled backup location. Do not commit it to Git because customer names and notes are private data. Follow the current Supabase CLI documentation when restoring; always test a restore against a separate project before using production.

## Private photo backup

Supabase database backups do not include Storage objects. The `customer-photos` bucket therefore needs its own export. Until PhotoDesk has a trusted server-side backup job, use an administrator-only script or Supabase-supported Storage tooling outside the web browser to copy every object while preserving its full path:

```text
customers/{customerId}/{photoId}/{filename}
```

The database dump and Storage copy must come from approximately the same time. Without both, photo metadata can point to missing files.

## Suggested shop routine

1. Check `/app/admin` weekly; investigate a red database status before customer work.
2. Download the metadata JSON weekly for a lightweight audit.
3. Confirm Supabase managed backup status, or create a CLI database dump on the chosen schedule.
4. Export the private Storage bucket on the same schedule.
5. Keep at least one encrypted copy separate from the shop computer.
6. Perform a restore rehearsal in a non-production Supabase project every three months.
7. Review inactive staff access whenever an employee leaves.

## Security boundary

A full backup needs database credentials or a privileged management token. Putting either in this Next.js client would expose it to every browser and could bypass RLS. For that reason, PhotoDesk deliberately does not place a one-click full-backup button in the admin page. A future automated backup should run in a trusted scheduled environment with secrets stored outside the browser.
