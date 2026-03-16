const orderDb = require("../db/orders");
const { formatResponse } = require("/opt/nodejs/utils/responseFormatter");
const { toSnakeCase } = require("/opt/nodejs/utils/caseConverter");
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

exports.updateOrder = async (req, res) => {
  try {
    console.log("[updateOrder] Request body:", JSON.stringify(req.body));
    const { id } = req.params;
    const { status, trackingUrl } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    // Get current order for transition validation and later comparison
    let currentOrder = null;
    if (status) {
      currentOrder = await orderDb.getOrder(req.pool, id);
      if (!currentOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

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

    // Send notification email to customer only if status has changed
    try {
      if (status && status !== currentOrder.status) {
        // Fetch customer email and name from users table
        const userResult = await req.pool.query(
          `SELECT email, first_name, last_name FROM ${process.env.ENVIRONMENT || "dev"}.users WHERE id = $1`,
          [currentOrder.user_id],
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const customerName = `${user.first_name} ${user.last_name}`.trim();
          await sendNotification({
            to: user.email,
            subject: `Order Update - Order #${currentOrder.order_number}`,
            template: "order-status-updated",
            data: {
              customerName: customerName,
              orderId: currentOrder.id,
              orderNumber: currentOrder.order_number,
              newStatus: status,
              trackingUrl: trackingUrl || currentOrder.tracking_url,
            },
          });
          console.log("[updateOrder] Notification sent to customer:", user.email);
        }
      }
    } catch (notificationError) {
      console.error("[updateOrder] Failed to send notification:", notificationError.message);
      // Don't fail the update if notification fails
    }

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

    res.json(formatResponse(updatedPayment));
  } catch (error) {
    console.error("[updatePayment] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};
