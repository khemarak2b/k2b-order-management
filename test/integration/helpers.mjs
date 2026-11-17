// T0.2: shared setup for integration tests. Real service code against a throwaway Postgres
// built from k2b-db-migrations (vendored as @k2b/db-migrations), never RDS.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Module from "node:module";
import { startTestDatabase } from "@k2b/db-migrations/testing";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FUNCTIONS = path.resolve(here, "../../amplify/backend/function");
const LAYER = path.join(FUNCTIONS, "k2bordermanagementlayer/lib/nodejs");

// In Lambda, /opt/nodejs/... is the layer; point it at the layer source here.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith("/opt/nodejs/")) {
    return originalResolve.call(this, path.join(LAYER, request.slice("/opt/nodejs/".length)), ...rest);
  }
  return originalResolve.call(this, request, ...rest);
};

/** require() for handler code, relative to amplify/backend/function. */
export const requireHandler = createRequire(path.join(FUNCTIONS, "_"));

/** Starts the database and sets ENVIRONMENT, which the services use as the schema name. */
export async function startDb() {
  const db = await startTestDatabase({ schema: "dev" });
  process.env.ENVIRONMENT = db.schema;
  return db;
}

let seq = 0;
const next = () => ++seq;

export async function insertUser(db, fields = {}) {
  const n = next();
  const { rows } = await db.query(
    `INSERT INTO dev.users (cognito_sub, first_name, last_name, email)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [fields.cognito_sub ?? `sub-${n}`, "Test", `User${n}`, fields.email ?? `user${n}@example.test`],
  );
  return rows[0];
}

export async function insertAdmin(db, fields = {}) {
  const n = next();
  const { rows } = await db.query(
    `INSERT INTO dev.admin_users (cognito_sub, first_name, last_name, email, role)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [`admin-sub-${n}`, fields.first_name ?? "Ada", fields.last_name ?? "Admin", `admin${n}@example.test`, fields.role ?? "ADMIN"],
  );
  return rows[0];
}

/** A product with one variant. Prices are strings or null, as Postgres numerics. */
export async function insertVariant(db, { price = "20.00", variantWholesale = null, productWholesale = null } = {}) {
  const n = next();
  const product = (
    await db.query(
      `INSERT INTO dev.products (shopify_id, name, title, wholesale_price) VALUES ($1, $2, $2, $3) RETURNING *`,
      [`gid://shopify/Product/${n}`, `Product ${n}`, productWholesale],
    )
  ).rows[0];
  const variant = (
    await db.query(
      `INSERT INTO dev.product_variants (product_id, shopify_variant_id, price, wholesale_price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [product.id, `gid://shopify/ProductVariant/${n}`, price, variantWholesale],
    )
  ).rows[0];
  return { product, variant };
}
