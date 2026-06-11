# Expense Markdown Model

The MVP stores food expenses as markdown pages because that is the simplest shape
for GBrain ingestion, retrieval, and synthesis.

## Invoice Pages

Use one page per receipt or invoice:

```text
expenses/invoices/YYYY-MM-DD-merchant.md
```

Recommended frontmatter:

```yaml
type: food_invoice
date: 2026-06-08
merchant: Green Market
currency: USD
total: 42.18
```

Recommended body:

```markdown
# Green Market - 2026-06-08

## Items

| Product | Quantity | Unit price | Total |
| --- | ---: | ---: | ---: |
| Eggs | 1 carton | 6.49 | 6.49 |

## Notes

Captured from a paper receipt.
```

## Merchant Pages

Merchant pages are optional, but useful when the agent sees repeated merchants:

```text
expenses/merchants/green-market.md
```

```yaml
type: merchant
name: Green Market
category: grocery
```

## Product Pages

Product pages are optional and useful for commonly purchased items:

```text
expenses/products/eggs.md
```

```yaml
type: food_product
name: Eggs
category: groceries
```

## Helper Script

`scripts/write-expense-page.mjs` writes invoice markdown from JSON:

```bash
node scripts/write-expense-page.mjs receipt.json
```

Example JSON:

```json
{
  "date": "2026-06-08",
  "merchant": "Green Market",
  "currency": "USD",
  "items": [
    { "product": "Eggs", "quantity": "1 carton", "unitPrice": 6.49, "total": 6.49 }
  ],
  "total": 6.49
}
```

After writing pages, import them into GBrain:

```bash
gbrain import expenses
```
