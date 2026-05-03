const ADMIN_CHANGE_REASONS = [
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

const ADMIN_CHANGE_REASON_MAP = new Map(ADMIN_CHANGE_REASONS.map((reason) => [reason.code, reason]));

const getAdminChangeReason = (reasonCode) => ADMIN_CHANGE_REASON_MAP.get(reasonCode) || null;

module.exports = {
  ADMIN_CHANGE_REASONS,
  getAdminChangeReason,
};
