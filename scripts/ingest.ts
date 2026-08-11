import { runIngestion } from "@/lib/ingest";

async function main() {
  console.log("Starting ingestion...");
  const result = await runIngestion();
  console.log(`Done. Fetched ${result.fetched} unique repos, upserted ${result.upserted}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Ingestion failed:", error);
    process.exit(1);
  });
