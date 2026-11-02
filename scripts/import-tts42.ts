import { importFromSource } from "../lib/importer";

importFromSource(process.argv[2]).then((r) => {
  console.log(`Imported: ${r.created} new, ${r.updated} updated, ${r.errors.length} errors (of ${r.total})`);
  r.errors.forEach((e) => console.error("  " + e));
  process.exit(0);
});
