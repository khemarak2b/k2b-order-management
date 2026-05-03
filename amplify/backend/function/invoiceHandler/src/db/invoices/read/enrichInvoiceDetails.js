const roundMoney = (value) => parseFloat((Number(value) || 0).toFixed(2));

const isAdditionalCharge = (item) => {
  const metadata = item?.metadata || {};
  return metadata.type === "additional_charge" || metadata.is_manual === true;
};

const enrichInvoiceDetails = (invoice) => {
  if (!invoice) {
    return invoice;
  }

  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const changeLog = Array.isArray(invoice.change_log) ? invoice.change_log : [];
  const additionalCharges = lineItems.filter(isAdditionalCharge);
  const additionalChargesTotal = additionalCharges.reduce((sum, item) => sum + (parseFloat(item.line_total) || 0), 0);

  return {
    ...invoice,
    additional_charges: additionalCharges,
    additional_charges_total: roundMoney(additionalChargesTotal),
    has_additional_charges: additionalCharges.length > 0,
    quantity_adjustments: changeLog.filter((change) => change.change_type === "quantity_updated"),
  };
};

module.exports = enrichInvoiceDetails;
