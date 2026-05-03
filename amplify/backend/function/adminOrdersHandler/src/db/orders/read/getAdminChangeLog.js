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

const getAdminChangeLog = async (client, orderId, schema) => {
  const changeLogResult = await client.query(
    `
      SELECT *
      FROM ${schema}.admin_change_log
      WHERE parent_entity_type = 'order' AND parent_entity_id = $1
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

module.exports = getAdminChangeLog;
