const orderDb = require("../db/orders");
const { formatResponse } = require("../utils/responseFormatter");
const { toSnakeCase } = require("../utils/caseConverter");

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

    const order = await orderDb.getOrders(req.pool, userId);

    if (!order) {
      return res.status(404).json({ error: "Orders not found" });
    }

    res.json(formatResponse(order));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const cart = await orderDb.getCart(req.pool, userId);

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    res.json(formatResponse(cart));
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

    await orderDb.deleteOrder(req.pool, id);
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const deleted = await orderDb.deleteCart(req.pool, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: "Cart not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createOrder = async (req, res) => {
  try {
    console.log("[createOrder] Request body:", JSON.stringify(req.body));
    const { userId, status, totalAmount } = req.body.order;

    if (userId == undefined || userId == null) {
      return res.status(400).json({ error: "Invalid userId: must be a not null value" });
    }
    if (status == undefined || status == null) {
      return res.status(400).json({ error: "Invalid status: must be a not null value" });
    }
    if (totalAmount !== undefined && totalAmount !== null) {
      if (isNaN(totalAmount) || parseFloat(totalAmount) < 0) {
        return res.status(400).json({ error: "Invalid totalAmount: must be a non-negative number" });
      }
    }

    const dbData = toSnakeCase(req.body.order);
    console.log("[createOrder] Creating Order with data:", JSON.stringify(dbData));
    const order = await orderDb.createOrder(req.pool, dbData);
    console.log("[createOrder] Order created successfully:", JSON.stringify(order));
    res.status(201).json(formatResponse(order));
  } catch (error) {
    console.error("[createOrder] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createCart = async (req, res) => {
  try {
    console.log("[createCart] Request body:", JSON.stringify(req.body));
    const { cart, cart_items } = req.body;
    const { userId } = cart || {};

    if (!userId) {
      return res.status(400).json({ error: "Invalid userId: must be a not null value" });
    }

    const dbData = {
      cart: toSnakeCase({ user_id: userId }),
      cart_items: Array.isArray(cart_items) ? cart_items.map(item => toSnakeCase(item)) : []
    };

    console.log("[createCart] Creating cart with data:", JSON.stringify(dbData));
    const result = await orderDb.createCart(req.pool, dbData);
    console.log("[createCart] cart created successfully:", JSON.stringify(result));
    res.status(201).json(formatResponse(result));
  } catch (error) {
    console.error("[createCart] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    console.log("[updateOrder] Request body:", JSON.stringify(req.body));
    const { cartId, userId, orderNumber, status, totalAmount, payMethod, createdAt, updatedAt } = req.body.order;

    if (userId == undefined || userId == null) {
      return res.status(400).json({ error: "Invalid userId: must be a not null value" });
    }
    if (status !== undefined || status !== null) {
      return res.status(400).json({ error: "Invalid status: must be a not null value" });
    }
    if (totalAmount !== undefined && totalAmount !== null) {
      if (isNaN(totalAmount) || parseFloat(totalAmount) < 0) {
        return res.status(400).json({ error: "Invalid totalAmount: must be a non-negative number" });
      }
    }

    const dbData = toSnakeCase(req.body.order);
    console.log("[updateOrder] Updating Order with data:", JSON.stringify(dbData));
    const order = await orderDb.updateOrder(req.pool, dbData);
    console.log("[updateOrder] Order updated successfully:", JSON.stringify(order));
    res.status(200).json(formatResponse(order));
  } catch (error) {
    console.error("[updateOrder] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.addCartItem = async (req, res) => {
  try {
    console.log("[addCartItem] Request body:", JSON.stringify(req.body));
    const { userId } = req.params;
    const itemData = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!itemData || Object.keys(itemData).length === 0) {
      return res.status(400).json({ error: "Item data is required" });
    }

    const dbData = toSnakeCase(itemData);
    console.log("[addCartItem] Adding item:", JSON.stringify(dbData));
    const item = await orderDb.addCartItem(req.pool, userId, dbData);
    console.log("[addCartItem] Item added successfully:", JSON.stringify(item));
    res.status(201).json(formatResponse(item));
  } catch (error) {
    console.error("[addCartItem] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    console.log("[updateCartItem] Request body:", JSON.stringify(req.body));
    const { userId, itemId } = req.params;
    const updateData = req.body;

    if (!userId || !itemId) {
      return res.status(400).json({ error: "User ID and Item ID are required" });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Update data is required" });
    }

    const dbData = toSnakeCase(updateData);
    console.log("[updateCartItem] Updating item:", JSON.stringify(dbData));
    const item = await orderDb.updateCartItem(req.pool, itemId, dbData);
    console.log("[updateCartItem] Item updated successfully:", JSON.stringify(item));
    res.status(200).json(formatResponse(item));
  } catch (error) {
    console.error("[updateCartItem] Error:", error.message, error.stack);
    if (error.message === "Cart item not found") {
      return res.status(404).json({ error: "Cart item not found" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteCartItem = async (req, res) => {
  try {
    const { userId, itemId } = req.params;

    if (!userId || !itemId) {
      return res.status(400).json({ error: "User ID and Item ID are required" });
    }

    const deleted = await orderDb.deleteCartItem(req.pool, itemId);

    if (!deleted) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("[deleteCartItem] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
