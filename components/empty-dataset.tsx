import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Rocket } from "lucide-react";

export function EmptyDataset() {
  return (
    <Alert>
      <Rocket className="h-4 w-4" />
      <AlertTitle>No data yet</AlertTitle>
      <AlertDescription>
        Run <code className="rounded bg-muted px-1 py-0.5">npm run ingest</code> to pull the first
        batch of repository stats from GitHub, or wait for the daily cron job to run on deploy.
      </AlertDescription>
    </Alert>
  );
}
