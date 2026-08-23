const orderDb = require("../db/orders");
const { formatResponse } = require("/opt/nodejs/utils/responseFormatter");
const { toSnakeCase } = require("/opt/nodejs/utils/caseConverter");
const { generateFormattedOrderId } = require("../utils/idGenerator");
const { sendNotification } = require("../utils/notificationService");
const { notifyCustomerOfOrderUpdate } = require("/opt/nodejs/utils/orderUpdateNotification");
const { getAdminChangeReason } = require("../constants/changeLog");
const {
  auditAdminOrderEvent,
  buildOrderChanges,
  buildPaymentChanges,
  findOrderItem,
  pickSafeOrderFields,
  pickSafePaymentFields,
} = require("../audit/adminOrderAudit");
const VALID_PAYMENT_METHODS = ["bank_transfer", "credit_card", "cash", "cash_on_delivery", "cheque"];

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const order = await orderDb.getOrder(req.pool, id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(formatResponse(order));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getOrderByOrderNumber = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({ error: "Order number is required" });
    }

    const order = await orderDb.getOrderByOrderNumber(req.pool, orderNumber);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(formatResponse(order));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const orders = await orderDb.getOrders(req.pool, userId);

    res.json(formatResponse(orders || []));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const {
      status,
      userId,
      minAmount,
      maxAmount,
      paymentStatus,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      orderNumber,
      limit = 20,
      offset = 0,
    } = req.query;

    // Validate status if provided
    if (status) {
      const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
    }

    // Validate payment status if provided
    if (paymentStatus) {
      const validPaymentStatuses = ["pending", "completed", "failed", "refunded"];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          error: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`,
        });
      }
    }

    // Validate pagination parameters
    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = parseInt(offset, 10);

    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      return res.status(400).json({ error: "Limit must be between 1 and 1000" });
    }

    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({ error: "Offset must be a non-negative integer" });
    }

    // Validate amount filters
    const parsedMinAmount = minAmount !== undefined ? parseFloat(minAmount) : undefined;
    const parsedMaxAmount = maxAmount !== undefined ? parseFloat(maxAmount) : undefined;

    if (minAmount !== undefined && (isNaN(parsedMinAmount) || parsedMinAmount < 0)) {
      return res.status(400).json({ error: "minAmount must be a non-negative number" });
    }

    if (maxAmount !== undefined && (isNaN(parsedMaxAmount) || parsedMaxAmount < 0)) {
      return res.status(400).json({ error: "maxAmount must be a non-negative number" });
    }

    // Build filters object
    const filters = {
      status,
      userId,
      minAmount: parsedMinAmount,
      maxAmount: parsedMaxAmount,
      paymentStatus,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
      orderNumber,
    };

    const result = await orderDb.getAllOrders(req.pool, filters, parsedLimit, parsedOffset);

    const page = Math.floor(result.offset / result.limit);
    const hasMore = result.offset + result.limit < result.total;

    res.json(
      formatResponse({
        data: result.orders,
        pagination: {
          total: result.total,
          page,
          pageSize: result.limit,
          offset: result.offset,
          hasMore,
        },
      }),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const {
      customerUserId,
      pricingProfileId = null,
      shippingAddress,
      billingAddress,
      items,
      notes,
      paymentMethod,
    } = req.body || {};

    if (!customerUserId) {
      return res.status(400).json({ error: "customerUserId is required" });
    }

    if (!shippingAddress) {
      return res.status(400).json({ error: "shippingAddress is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one order item is required" });
    }

    if (paymentMethod && !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({
        error: `Invalid payment method. Must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
      });
    }

    if (pricingProfileId) {
      const profileAccessResult = await req.pool.query(
        `
          SELECT 1
          FROM ${process.env.ENVIRONMENT || "dev"}.admin_pricing_profiles
          WHERE admin_user_id = $1 AND profile_id = $2
          LIMIT 1
        `,
        [req.user?.adminId, pricingProfileId],
      );

      if (profileAccessResult.rows.length === 0) {
        return res.status(403).json({ error: "Selected pricing profile is not assigned to this admin" });
      }
    }

    const orderSeed = {
      user_id: customerUserId,
      order_number: generateFormattedOrderId(),
      status: "pending",
      currency_code: "AUD",
      notes: notes || null,
      shipping_address: shippingAddress,
      billing_address: billingAddress || shippingAddress,
      created_by_admin: true,
      created_by_admin_id: req.user?.adminId || null,
      pricing_profile_id: pricingProfileId,
      order_items: Array.isArray(items) ? items.map((item) => toSnakeCase(item)) : [],
    };

    const result = await orderDb.createOrder(req.pool, orderSeed);

    let createdPayment = null;
    if (paymentMethod) {
      createdPayment = await orderDb.createPayment(req.pool, {
        order_id: result.order.id,
        payment_method: paymentMethod,
        amount: result.order.total_amount,
        status: "pending",
        payment_details: null,
      });
    }

    const fullOrder = await orderDb.getOrder(req.pool, result.order.id);

    await auditAdminOrderEvent(req, {
      eventType: "ADMIN_ORDER_CREATED",
      action: "CREATE",
      severity: "MEDIUM",
      order: fullOrder || result.order,
      changes: { before: {}, after: pickSafeOrderFields(fullOrder || result.order) },
      metadata: { itemCount: (fullOrder?.items || result.items || []).length },
    });

    if (createdPayment) {
      await auditAdminOrderEvent(req, {
        eventType: "ADMIN_ORDER_PAYMENT_CREATED",
        action: "CREATE",
        severity: "HIGH",
        category: "PAYMENT",
        resourceType: "PAYMENT",
        order: fullOrder || result.order,
        payment: createdPayment,
        changes: { before: {}, after: pickSafePaymentFields(createdPayment) },
      });
    }

    try {
      await sendOrderCreatedNotification(result, req.pool);
    } catch (notificationError) {
      console.warn("[admin createOrder] Failed to send notification:", notificationError.message);
    }

    res.status(201).json(formatResponse(fullOrder || result.order));
  } catch (error) {
    console.error("[admin createOrder] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const order = await orderDb.getOrder(req.pool, id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    await orderDb.deleteOrder(req.pool, id);
    await auditAdminOrderEvent(req, {
      eventType: "ADMIN_ORDER_DELETED",
      action: "DELETE",
      severity: "HIGH",
      order,
      changes: { before: pickSafeOrderFields(order), after: {} },
      metadata: { itemCount: (order.items || []).length, paymentCount: (order.payments || []).length },
    });
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    console.log("[updateOrder] Request body:", JSON.stringify(req.body));
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Get current order for transition validation and audit comparison.
    const currentOrder = await orderDb.getOrder(req.pool, id);
    if (!currentOrder) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (status) {
      // Validate status
      const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }

      // Validate transition
      const validTransitions = {
        pending: ["processing", "cancelled"],
        processing: ["shipped", "cancelled"],
        shipped: ["delivered"],
        delivered: ["refunded"],
        cancelled: [],
        refunded: [],
      };

      if (!validTransitions[currentOrder.status]?.includes(status)) {
        return res.status(400).json({
          error: `Cannot transition from ${currentOrder.status} to ${status}`,
        });
      }
    }

    // Validate tracking URL if provided
    if (trackingUrl) {
      try {
        new URL(trackingUrl);
      } catch {
        return res.status(400).json({ error: "Invalid tracking URL format" });
      }
    }

    const dbData = toSnakeCase({ ...req.body, id });
    console.log("[updateOrder] Updating Order with data:", JSON.stringify(dbData));
    const order = await orderDb.updateOrder(req.pool, dbData);
    console.log("[updateOrder] Order updated successfully:", JSON.stringify(order));

    const statusChanged = Boolean(status && status !== currentOrder.status);
    await auditAdminOrderEvent(req, {
      eventType: statusChanged ? "ADMIN_ORDER_STATUS_CHANGED" : "ADMIN_ORDER_UPDATED",
      action: "UPDATE",
      severity: "MEDIUM",
      order: order || currentOrder,
      changes: buildOrderChanges(currentOrder, order || currentOrder),
      metadata: statusChanged
        ? { previousStatus: currentOrder.status, newStatus: status }
        : {},
    });

    await notifyCustomerOfOrderUpdate({
      pool: req.pool,
      previousOrder: currentOrder,
      updatedOrder: order,
      sendNotification,
      source: "admin-order-update",
    });

    res.status(200).json(formatResponse(order));
  } catch (error) {
    console.error("[updateOrder] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateOrderItemQuantity = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
    const schema = process.env.ENVIRONMENT || "dev";
    const quantity = Number(req.body?.quantity);
    const reasonCode = req.body?.reasonCode || req.body?.reason_code;
    const adminNote = typeof req.body?.adminNote === "string" ? req.body.adminNote.trim() : req.body?.admin_note;

    if (!orderId || !itemId) {
      return res.status(400).json({ error: "Order ID and item ID are required" });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ error: "Quantity must be a non-negative integer" });
    }

    const reason = await getAdminChangeReason(req.pool, schema, reasonCode);
    if (!reason) {
      return res.status(400).json({ error: "A valid reason code is required" });
    }

    const previousOrder = await orderDb.getOrder(req.pool, orderId);
    if (!previousOrder) {
      return res.status(404).json({ error: "Order not found" });
    }
    const previousItem = findOrderItem(previousOrder, itemId);

    const order = await orderDb.updateOrderItemQuantity(req.pool, {
      orderId,
      itemId,
      quantity,
      reasonCode: reason.code,
      reasonLabel: reason.label,
      adminNote: adminNote || null,
      updatedBy: req.user?.sub,
    });

    const updatedItem = findOrderItem(order, itemId);
    await auditAdminOrderEvent(req, {
      eventType: "ADMIN_ORDER_ITEM_QUANTITY_CHANGED",
      action: "UPDATE",
      severity: "MEDIUM",
      resourceType: "ORDER_ITEM",
      order,
      item: updatedItem || previousItem,
      changes: {
        before: {
          quantity: previousItem?.quantity,
          lineTotal: previousItem?.line_total,
        },
        after: {
          quantity: updatedItem?.quantity ?? quantity,
          lineTotal: updatedItem?.line_total,
        },
      },
      metadata: { reasonCode: reason.code, reasonLabel: reason.label },
    });

    res.status(200).json(formatResponse(order));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error("[updateOrderItemQuantity] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========== PAYMENT METHODS ==========

exports.createPayment = async (req, res) => {
  try {
    console.log("[createPayment] Request body:", JSON.stringify(req.body));
    const { orderId } = req.params;
    const { paymentMethod, amount, paymentDetails } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: "Payment method is required" });
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error("[createPayment] Invalid amount:", { amount, parsedAmount, type: typeof amount });
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    // Verify order exists
    const order = await orderDb.getOrder(req.pool, orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const payment = await orderDb.createPayment(req.pool, {
      order_id: orderId,
      payment_method: paymentMethod,
      amount: parsedAmount,
      status: "pending",
      payment_details: paymentDetails || null,
    });
    console.log("[createPayment] Payment created successfully:", JSON.stringify(payment));
    await auditAdminOrderEvent(req, {
      eventType: "ADMIN_ORDER_PAYMENT_CREATED",
      action: "CREATE",
      severity: "HIGH",
      category: "PAYMENT",
      resourceType: "PAYMENT",
      order,
      payment,
      changes: { before: {}, after: pickSafePaymentFields(payment) },
    });
    res.status(201).json(formatResponse(payment));
  } catch (error) {
    console.error("[createPayment] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPayments = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    const payments = await orderDb.getPayments(req.pool, orderId);
    res.json(formatResponse(payments || []));
  } catch (error) {
    console.error("[getPayments] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { orderId, paymentId } = req.params;

    if (!orderId || !paymentId) {
      return res.status(400).json({ error: "Order ID and Payment ID are required" });
    }

    const payment = await orderDb.getPayment(req.pool, paymentId, orderId);

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.json(formatResponse(payment));
  } catch (error) {
    console.error("[getPayment] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    console.log("[updatePayment] Request body:", JSON.stringify(req.body));
    const { orderId, paymentId } = req.params;
    const { status } = req.body;

    if (!orderId || !paymentId) {
      return res.status(400).json({ error: "Order ID and Payment ID are required" });
    }

    // Validate payment status
    const validStatuses = ["pending", "completed", "failed", "refunded"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Verify payment exists and belongs to order
    const payment = await orderDb.getPayment(req.pool, paymentId, orderId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const dbData = { id: paymentId, ...toSnakeCase(req.body) };
    console.log("[updatePayment] Updating payment with data:", JSON.stringify(dbData));
    const updatedPayment = await orderDb.updatePayment(req.pool, dbData);
    console.log("[updatePayment] Payment updated successfully:", JSON.stringify(updatedPayment));

    const order = await orderDb.getOrder(req.pool, orderId);
    await auditAdminOrderEvent(req, {
      eventType: "ADMIN_ORDER_PAYMENT_UPDATED",
      action: "UPDATE",
      severity: "HIGH",
      category: "PAYMENT",
      resourceType: "PAYMENT",
      order,
      payment: updatedPayment || payment,
      changes: buildPaymentChanges(payment, updatedPayment || payment),
    });

    res.json(formatResponse(updatedPayment));
  } catch (error) {
    console.error("[updatePayment] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

async function sendOrderCreatedNotification(orderResults, pool) {
  const { order } = orderResults;
  const client = await pool.connect();

  try {
    const schema = process.env.ENVIRONMENT || "dev";
    const result = await client.query(`SELECT email FROM ${schema}.users WHERE id = $1`, [order.user_id]);

    if (result.rows.length === 0) {
      throw new Error(`User not found for order ${order.id}`);
    }

    const user = result.rows[0];
    const formatAusDate = (date) => {
      if (!date) return null;
      return new Date(date).toLocaleDateString("en-AU");
    };

    await sendNotification({
      to: user.email,
      subject: `Order Received #${order.order_number}`,
      template: "order-received",
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        userId: order.user_id,
        totalAmount: order.total_amount,
        subtotal: order.subtotal,
        taxAmount: order.tax_amount,
        shippingCost: order.shipping_cost,
        discountAmount: order.discount_amount,
        currencyCode: order.currency_code,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        notes: order.notes,
        createdAt: formatAusDate(order.created_at),
        updatedAt: formatAusDate(order.updated_at),
      },
    });
  } finally {
    client.release();
  }
}
