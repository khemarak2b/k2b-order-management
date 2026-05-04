const TENANT_ID = "83c12185-4e4c-421b-aed1-4089726b13ea";
const CONFIG_KEY = "ADMIN_CHANGE_REASONS";

const DEFAULT_ADMIN_CHANGE_REASONS = [
  {
    code: "customer_request",
    label: "Customer request",
  },
  {
    code: "stock_correction",
    label: "Stock correction",
  },
  {
    code: "pricing_pack_fix",
    label: "Pricing or pack size correction",
  },
  {
    code: "damaged_item_removed",
    label: "Damaged item removed",
  },
  {
    code: "manual_admin_correction",
    label: "Manual admin correction",
  },
];

const isValidReason = (reason) =>
  !!reason &&
  typeof reason === "object" &&
  typeof reason.code === "string" &&
  reason.code.trim().length > 0 &&
  typeof reason.label === "string" &&
  reason.label.trim().length > 0;

const normalizeReasons = (reasons) =>
  Array.isArray(reasons)
    ? reasons
        .filter(isValidReason)
        .map((reason) => ({
          code: reason.code.trim(),
          label: reason.label.trim(),
        }))
    : [];

const getAdminChangeReasons = async (executor, schema) => {
  try {
    const result = await executor.query(
      `
        SELECT config_value
        FROM ${schema}.configurations
        WHERE tenant_id = $1
          AND config_key = $2
          AND is_active = true
          AND (effective_from IS NULL OR effective_from <= NOW())
          AND (effective_to IS NULL OR effective_to >= NOW())
        LIMIT 1
      `,
      [TENANT_ID, CONFIG_KEY],
    );

    if (result.rows.length === 0) {
      return DEFAULT_ADMIN_CHANGE_REASONS;
    }

    const normalizedReasons = normalizeReasons(result.rows[0]?.config_value);
    return normalizedReasons.length > 0 ? normalizedReasons : DEFAULT_ADMIN_CHANGE_REASONS;
  } catch (error) {
    console.warn("[changeLog] Falling back to default admin change reasons:", error.message);
    return DEFAULT_ADMIN_CHANGE_REASONS;
  }
};

const getAdminChangeReason = async (executor, schema, reasonCode) => {
  const reasons = await getAdminChangeReasons(executor, schema);
  return reasons.find((reason) => reason.code === reasonCode) || null;
};

module.exports = {
  DEFAULT_ADMIN_CHANGE_REASONS,
  getAdminChangeReasons,
  getAdminChangeReason,
};
