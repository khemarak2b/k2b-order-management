const recordPayment = async (pool, invoiceId, paymentData) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { amount, payment_method, payment_reference, payment_date, notes, recorded_by } = paymentData;

    await client.query("BEGIN");

    // Step 1: Get invoice details including order_id
    const invoiceQuery = `SELECT * FROM ${schema}.invoices WHERE id = $1`;
    const invoiceResult = await client.query(invoiceQuery, [invoiceId]);

    if (invoiceResult.rows.length === 0) {
      throw new Error("Invoice not found");
    }

    const invoice = invoiceResult.rows[0];
    const { order_id, total_amount } = invoice;
    const totalAmountDecimal = parseFloat(total_amount);

    // Step 2: Insert into invoice_payments (detailed ledger/audit trail)
    const insertPaymentQuery = `
      INSERT INTO ${schema}.invoice_payments (
        invoice_id, amount, payment_method, payment_reference,
        payment_date, status, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const paymentResult = await client.query(insertPaymentQuery, [
      invoiceId,
      parseFloat(amount),
      payment_method || null,
      payment_reference || null,
      payment_date || new Date().toISOString().split("T")[0],
      "completed",
      notes || null,
      recorded_by || null,
    ]);

    const invoicePayment = paymentResult.rows[0];

    // Step 3: Calculate total payments for this invoice
    const sumPaymentsQuery = `
      SELECT COALESCE(SUM(amount)::DECIMAL, 0::DECIMAL) as total_paid
      FROM ${schema}.invoice_payments
      WHERE invoice_id = $1 AND status = 'completed'
    `;

    const sumResult = await client.query(sumPaymentsQuery, [invoiceId]);
    const totalPaid = parseFloat(sumResult.rows[0].total_paid);

    // Step 4: Update invoice payment fields
    const updateInvoiceQuery = `
      UPDATE ${schema}.invoices
      SET 
        amount_paid = $1::DECIMAL,
        amount_due = $2::DECIMAL,
        payment_status = CASE
          WHEN $1::DECIMAL >= $3::DECIMAL THEN 'paid'
          WHEN $1::DECIMAL > 0 THEN 'partially_paid'
          ELSE 'unpaid'
        END,
        paid_at = CASE
          WHEN $1::DECIMAL >= $3::DECIMAL THEN NOW()
          ELSE paid_at
        END,
        updated_by = $5,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const updatedInvoiceResult = await client.query(updateInvoiceQuery, [
      totalPaid,
      Math.max(0, totalAmountDecimal - totalPaid),
      totalAmountDecimal,
      invoiceId,
      recorded_by || null,
    ]);

    const updatedInvoice = updatedInvoiceResult.rows[0];

    // Step 5: Update order's payment record status if fully paid
    if (totalPaid >= totalAmountDecimal) {
      const updatePaymentQuery = `
        UPDATE ${schema}.payments
        SET status = 'completed', updated_at = NOW()
        WHERE order_id = $1
        RETURNING *
      `;

      await client.query(updatePaymentQuery, [order_id]);
    }

    await client.query("COMMIT");

    return {
      invoicePayment,
      invoice: updatedInvoice,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = recordPayment;
