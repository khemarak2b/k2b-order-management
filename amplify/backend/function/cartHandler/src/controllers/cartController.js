const cartDb = require("../db/cart");
const { formatResponse } = require("../utils/responseFormatter");
const { toSnakeCase } = require("../utils/caseConverter");

exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const cart = await cartDb.getCart(req.pool, userId);

    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    res.json(formatResponse(cart));
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

    const deleted = await cartDb.deleteCart(req.pool, userId);

    if (!deleted) {
      return res.status(404).json({ error: "Cart not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
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
      cart_items: Array.isArray(cart_items) ? cart_items.map((item) => toSnakeCase(item)) : [],
    };

    console.log("[createCart] Creating cart with data:", JSON.stringify(dbData));
    const result = await cartDb.createCart(req.pool, dbData);
    console.log("[createCart] cart created successfully:", JSON.stringify(result));
    res.status(201).json(formatResponse(result));
  } catch (error) {
    console.error("[createCart] Error:", error.message, error.stack);
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
    const item = await cartDb.addCartItem(req.pool, userId, dbData);
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
    const item = await cartDb.updateCartItem(req.pool, itemId, dbData);
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

    const deleted = await cartDb.deleteCartItem(req.pool, itemId);

    if (!deleted) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("[deleteCartItem] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
