/** Dump the current design-token stylesheets to files (patched-copy probes).
 * Usage: node css-dump.mjs <theme.css out> <base.css out> */
import { writeFileSync } from "node:fs";
import { PAGE_CSS, TOKENS_CSS } from "../src/design-tokens";

writeFileSync(process.argv[2], TOKENS_CSS);
writeFileSync(process.argv[3], PAGE_CSS);
console.log("css dumped");
