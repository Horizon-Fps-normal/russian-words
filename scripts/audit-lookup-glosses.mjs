import { readFile } from "node:fs/promises";
import { auditLookup } from "./lookup-gloss-utils.mjs";

const path = process.argv[2] || "src/data/open-russian-lookup.json";
const entries = JSON.parse(await readFile(path, "utf8"));
const report = auditLookup(entries);
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
