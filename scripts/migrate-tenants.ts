// One-off: turns each old `tenants` document into a Tenant and a Lease (ADR 0001).
// Each old document is first copied to `legacyTenants`. Safe to run again: it skips
// anything already done. Look before you leap:
//
//   npm run migrate-tenants -- --dry-run
//   npm run migrate-tenants
import nextEnv from "@next/env";
import { getLeaseModule } from "../src/lib/lease/server";

async function main() {
  nextEnv.loadEnvConfig(process.cwd());
  const dryRun = process.argv.includes("--dry-run");

  const report = await getLeaseModule().migrate({ dryRun });

  for (const step of report.steps) {
    console.log(`${step.outcome.padEnd(8)} ${step.legacyId}  ${step.name || "(unsigned)"} -> ${step.becomes}`);
  }
  if (dryRun) {
    console.log(`\nDry run: ${report.steps.length} old record(s) would be migrated. Nothing was written.`);
  } else {
    console.log(`\nMigrated ${report.migrated}, skipped ${report.skipped}.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
