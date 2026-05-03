const parseJsonValue = (value) => {
  if (!value) {
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
};

const readInvoiceChangeLog = async (executor, orderId, schema) => {
  const changeLogResult = await executor.query(
    `
      SELECT *
      FROM ${schema}.admin_change_log
      WHERE parent_entity_type = 'order'
        AND parent_entity_id = $1
        AND change_type = 'quantity_updated'
      ORDER BY changed_at DESC, id DESC
    `,
    [orderId],
  );

  return changeLogResult.rows.map((change) => ({
    ...change,
    before_value: parseJsonValue(change.before_value),
    after_value: parseJsonValue(change.after_value),
    metadata: parseJsonValue(change.metadata),
  }));
};

const getInvoiceChangeLog = async (clientOrPool, orderId, schema) => {
  if (!clientOrPool) {
    return [];
  }

  // A checked-out pg client already has `query`/`release`; reconnecting it throws.
  if (typeof clientOrPool.query === "function" && typeof clientOrPool.release === "function") {
    return readInvoiceChangeLog(clientOrPool, orderId, schema);
  }

  if (typeof clientOrPool.connect === "function") {
    const client = await clientOrPool.connect();

    try {
      return await readInvoiceChangeLog(client, orderId, schema);
    } finally {
      client.release();
    }
  }

  return readInvoiceChangeLog(clientOrPool, orderId, schema);
};

module.exports = getInvoiceChangeLog;
