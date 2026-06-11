#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const inputPath = process.argv[2];
const outputRoot = process.env.EXPENSE_OUTPUT_DIR || "expenses/invoices";

const input = inputPath
  ? await readFile(inputPath, "utf8")
  : await readStdin();

const invoice = JSON.parse(input);
const markdown = renderInvoice(invoice);
const filename = `${slug(invoice.date || today())}-${slug(invoice.merchant || "unknown-merchant")}.md`;
const outputPath = join(outputRoot, filename);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, markdown, "utf8");
console.log(outputPath);

function renderInvoice(invoice) {
  const date = invoice.date || today();
  const merchant = invoice.merchant || "Unknown merchant";
  const currency = invoice.currency || "USD";
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const total = invoice.total ?? sumItems(items);

  const rows = items.map((item) => {
    const product = item.product || item.name || "Unknown product";
    const quantity = item.quantity || "";
    const unitPrice = money(item.unitPrice ?? item.unit_price ?? "");
    const lineTotal = money(item.total ?? "");
    return `| ${escapeCell(product)} | ${escapeCell(quantity)} | ${unitPrice} | ${lineTotal} |`;
  });

  return `---
type: food_invoice
date: ${date}
merchant: ${merchant}
currency: ${currency}
total: ${money(total)}
---

# ${merchant} - ${date}

## Items

| Product | Quantity | Unit price | Total |
| --- | ---: | ---: | ---: |
${rows.join("\n") || "| No items captured |  |  |  |"}

## Notes

${invoice.notes || "Captured for GBrain indexing."}
`;
}

function sumItems(items) {
  return items.reduce((sum, item) => sum + Number(item.total || 0), 0);
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function money(value) {
  if (value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : String(value);
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "/");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
