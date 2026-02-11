const recordPayment = async (pool, invoiceId, paymentData) => {
  const client = await pool.connect();
  const schema = process.env.ENVIRONMENT || "dev";

  try {
    const { amount, payment_method, payment_reference, payment_date, notes, recorded_by } = paymentData;

    await client.query("BEGIN");

    // Insert payment record
    const paymentQuery = `
      INSERT INTO ${schema}.invoice_payments (
        invoice_id, amount, payment_method, payment_reference,
        payment_date, status, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const paymentResult = await client.query(paymentQuery, [
      invoiceId,
      amount,
      payment_method || null,
      payment_reference || null,
      payment_date || new Date().toISOString().split("T")[0],
      "completed",
      notes || null,
      recorded_by || null,
    ]);

    const payment = paymentResult.rows[0];

    // Update invoice amount_paid and payment_status
    const invoiceQuery = `
      UPDATE ${schema}.invoices
      SET 
        amount_paid = amount_paid + $1,
        amount_due = total_amount - (amount_paid + $1),
        payment_status = CASE
          WHEN (amount_paid + $1) >= total_amount THEN 'paid'
          WHEN (amount_paid + $1) > 0 THEN 'partially_paid'
          ELSE 'unpaid'
        END
      WHERE id = $2
      RETURNING *
    `;

    const invoiceResult = await client.query(invoiceQuery, [amount, invoiceId]);

    if (invoiceResult.rows.length === 0) {
      throw new Error("Invoice not found");
    }

    await client.query("COMMIT");

    return {
      payment,
      invoice: invoiceResult.rows[0],
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

module.exports = recordPayment;
