# Codex Memory: k2b-order-management

Last updated: 2026-03-07

## Purpose
AWS Amplify Gen1 backend for order management:
- cart
- orders
- admin orders
- invoices (with PDF generation + S3 storage)

## Top-level architecture
- API Gateway resource: `orderManagementApi`
- Lambda handlers:
  - `cartHandler` -> `/cart`
  - `ordersHandler` -> `/orders`
  - `adminOrdersHandler` -> `/admin-orders`
  - `invoiceHandler` -> `/invoices` and `/admin-invoices`
- Shared layers:
  - `k2bordermanagementlayer`: DB pool, auth/authorization middleware, case/response utilities
  - `k2bordermanagementlayer2`: invoice PDF dependencies (`puppeteer-core`, `@sparticuz/chromium`, `handlebars`)

## Runtime/request pattern
All handlers follow the same pattern:
1. Express app + `serverless-http`
2. Reused module-level PG pool from `/opt/nodejs/database/db`
3. Cognito auth provider injected from API Gateway event header
4. Auth middleware maps Cognito `sub` to DB user/admin
5. Controllers call DB modules in `src/db/**`
6. Responses transformed to camelCase via `formatResponse`

## Key invoice flow
Main file: `amplify/backend/function/invoiceHandler/src/controllers/invoiceController.js`

Generate invoice from order (`POST /admin-invoices/order/:orderId/generate`):
1. Fetch order + order_items
2. Build invoice data (GST-inclusive extraction model)
3. Create invoice or regenerate existing invoice + line items
4. Render Handlebars HTML
5. Generate PDF via Puppeteer/Chromium
6. Upload PDF to S3 invoice bucket
7. Store `pdf_url` + `pdf_generated_at`

## Important files
- Entry points:
  - `amplify/backend/function/ordersHandler/src/index.js`
  - `amplify/backend/function/adminOrdersHandler/src/index.js`
  - `amplify/backend/function/cartHandler/src/index.js`
  - `amplify/backend/function/invoiceHandler/src/index.js`
- Invoice internals:
  - `amplify/backend/function/invoiceHandler/src/controllers/invoiceController.js`
  - `amplify/backend/function/invoiceHandler/src/db/invoices/index.js`
  - `amplify/backend/function/invoiceHandler/src/db/invoices/update/updateInvoice.js`
  - `amplify/backend/function/invoiceHandler/src/templates/templateHelper.js`
  - `amplify/backend/function/invoiceHandler/src/templates/invoice.hbs`
  - `amplify/backend/function/invoiceHandler/src/utils/pdfGenerator.js`
  - `amplify/backend/function/invoiceHandler/src/utils/s3Storage.js`

## Known risks/gotchas
1. `deleteOrder` bug in orders/admin DB modules:
   - Uses `DELETE FROM ...orders WHERE order_id = $1` (likely should be `id = $1`).
2. Env var naming mismatch:
   - DB modules use `process.env.ENVIRONMENT || "dev"`.
   - Lambda templates set `ENV` (not `ENVIRONMENT`) in some places.
3. PDF S3 key year dependency:
   - Presigned URL builder uses current year in key path.
   - May fail for invoices generated in prior years.
4. `updateInvoice` JSONB handling:
   - Handles `company_address` but invoice schema uses `company_details`.
   - Some JSONB fields may be inconsistently stringified/parsed.

## Auth model summary
- User routes: `authMiddleware` + ownership checks.
- Admin routes: `adminAuthMiddleware` + `requireAdmin`.
- Optional bypass: `BYPASS_AUTH=true` in env (for quick testing; should stay false in real envs).

## Database/migrations snapshot
- Cart and order tables: `scripts/migrations/001-create-cart-tables.sql`, `002-create-orders-tables.sql`
- Invoice tables:
  - `scripts/create_invoices_table.sql`
  - `scripts/create_invoice_line_items_table.sql`
- Invoice tables include soft delete (`deleted_at`) and payment ledger (`invoice_payments`).

## Deployment notes
- Scripts:
  - `build.sh` (init/config/bootstrap)
  - `deploy.sh` (init + `amplify push`)
- Custom resource:
  - `amplify/backend/custom/InvoiceBucket/InvoiceBucket-cloudformation-template.json`

