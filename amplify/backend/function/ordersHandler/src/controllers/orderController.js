const orderDb = require("../db/orders");
const { formatResponse } = require("/opt/nodejs/utils/responseFormatter");
const { toSnakeCase } = require("/opt/nodejs/utils/caseConverter");
const { generateFormattedOrderId } = require("../utils/idGenerator");
const { sendNotification } = require("../utils/notificationService");

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
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createOrder = async (req, res) => {
  try {
    console.log("[createOrder] Request body:", JSON.stringify(req.body));
    const {
      userId,
      subtotal,
      taxAmount = 0,
      shippingCost = 0,
      discountAmount = 0,
      totalAmount,
      currencyCode = "AUD",
      notes,
      shippingAddress,
      billingAddress,
      orderItems,
      items,
    } = req.body;

    // Support both 'orderItems' and 'items' field names
    const finalOrderItems = orderItems || items;

    // Validation
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ error: "totalAmount is required" });
    }
    if (isNaN(totalAmount) || parseFloat(totalAmount) < 0) {
      return res.status(400).json({ error: "totalAmount must be a non-negative number" });
    }
    if (!shippingAddress) {
      return res.status(400).json({ error: "shippingAddress is required" });
    }

    const order = {
      user_id: userId,
      order_number: generateFormattedOrderId(),
      status: "pending",
      subtotal: subtotal || totalAmount,
      tax_amount: taxAmount,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      currency_code: currencyCode,
      notes: notes || null,
      shipping_address: shippingAddress,
      billing_address: billingAddress || shippingAddress,
      order_items: Array.isArray(finalOrderItems) ? finalOrderItems.map((item) => toSnakeCase(item)) : [],
    };

    console.log("[createOrder] Creating Order with data:", JSON.stringify(order));
    const result = await orderDb.createOrder(req.pool, order);
    console.log("[createOrder] Order created successfully:", JSON.stringify(result));

    // Send order confirmation email
    try {
      await sendOrderCreatedNotification(result, req.pool);
    } catch (err) {
      console.warn("[createOrder] Failed to send notification:", err.message);
      // Don't fail the request if notification fails
    }

    // Clear user's cart after order creation (ignore errors if cart doesn't exist)
    try {
      await orderDb.deleteCart(req.pool, userId);
    } catch (err) {
      console.warn("[createOrder] Failed to clear cart:", err.message);
    }

    res.status(201).json(formatResponse(result));
  } catch (error) {
    console.error("[createOrder] Error:", error.message, error.stack);
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

    // Validate status transition
    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    // Get current order to validate transition
    if (status) {
      const currentOrder = await orderDb.getOrder(req.pool, id);
      if (!currentOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

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

    const dbData = toSnakeCase({ ...req.body, id });
    console.log("[updateOrder] Updating Order with data:", JSON.stringify(dbData));
    const order = await orderDb.updateOrder(req.pool, dbData);
    console.log("[updateOrder] Order updated successfully:", JSON.stringify(order));
    res.status(200).json(formatResponse(order));
  } catch (error) {
    console.error("[updateOrder] Error:", error.message, error.stack);
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

    // If payment is completed, update order status to processing and send SQS notification
    if (status === "completed" && payment.status !== "completed") {
      await orderDb.updateOrder(req.pool, { id: orderId, status: "processing" });

      // Send notification to notification service
      try {
        const order = await orderDb.getOrder(req.pool, orderId);
        await sendOrderNotification(order, updatedPayment);
      } catch (err) {
        console.warn("[updatePayment] Failed to send notification:", err.message);
        // Don't fail the request if notification fails
      }
    }

    res.json(formatResponse(updatedPayment));
  } catch (error) {
    console.error("[updatePayment] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Send order created notification using notification service
 */
async function sendOrderCreatedNotification(orderResults, pool) {
  const { order } = orderResults;

  // Fetch user email from users table
  const client = await pool.connect();
  try {
    const schema = process.env.ENVIRONMENT || "dev";
    const result = await client.query(`SELECT email FROM ${schema}.users WHERE id = $1`, [order.user_id]);

    if (result.rows.length === 0) {
      throw new Error(`User not found for order ${order.id}`);
    }

    const user = result.rows[0];

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
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });
  } finally {
    client.release();
  }
}

/**
 * Send order placement notification using notification service
 */
async function sendOrderNotification(order, payment) {
  await sendNotification({
    to: order.email,
    subject: `Payment Received #${order.order_number}`,
    template: "payment-received",
    data: {
      orderId: order.id,
      orderNumber: order.order_number,
      userId: order.user_id,
      totalAmount: order.total_amount,
      paymentMethod: payment.payment_method,
      paymentStatus: payment.status,
      subtotal: order.subtotal,
      taxAmount: order.tax_amount,
      shippingCost: order.shipping_cost,
      discountAmount: order.discount_amount,
      currencyCode: order.currency_code,
      shippingAddress: order.shipping_address,
      billingAddress: order.billing_address,
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
  });
}
