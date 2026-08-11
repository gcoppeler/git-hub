import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DatabaseZap } from "lucide-react";

export function SetupRequired() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Alert>
        <DatabaseZap className="h-4 w-4" />
        <AlertTitle>Database not configured</AlertTitle>
        <AlertDescription>
          <p className="mt-1">Set a `DATABASE_URL` environment variable to a Neon Postgres connection string, then run:</p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
{`npm run db:push   # create tables
npm run ingest     # pull the first batch of repo stats`}
          </pre>
          <p className="mt-3">See the README for full setup instructions.</p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
