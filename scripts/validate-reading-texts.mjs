import { readingTexts } from "../src/data/reading-texts.js";
import { auditReadingTexts } from "./reading-content-utils.mjs";

const report = auditReadingTexts(readingTexts);
console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
