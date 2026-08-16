const cartDb = require("../db/cart");
const { formatResponse } = require("/opt/nodejs/utils/responseFormatter");
const { toSnakeCase } = require("/opt/nodejs/utils/caseConverter");
const {
  auditCartEvent,
  buildCartItemChanges,
  findCartItem,
} = require("../audit/cartAudit");

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

    const cart = await cartDb.getCart(req.pool, userId);
    const deleted = await cartDb.deleteCart(req.pool, userId);

    if (!deleted) {
      return res.status(404).json({ error: "Cart not found" });
    }

    await auditCartEvent(req, {
      eventType: "CART_DELETED",
      action: "DELETE",
      cart,
      metadata: { itemCount: cart?.items?.length || 0 },
    });

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createCart = async (req, res) => {
  try {
    const { cart, cartItems } = req.body;
    const { userId } = cart || {};

    if (!userId) {
      return res.status(400).json({ error: "Invalid userId: must be a not null value" });
    }

    const dbData = {
      cart: toSnakeCase({ user_id: userId }),
      cart_items: Array.isArray(cartItems) ? cartItems.map((item) => toSnakeCase(item)) : [],
    };

    const result = await cartDb.createCart(req.pool, dbData);
    const { cartCreated, ...responseResult } = result;

    if (cartCreated) {
      await auditCartEvent(req, {
        eventType: "CART_CREATED",
        action: "CREATE",
        cart: result.cart,
        metadata: { itemCount: result.items.length },
      });
    }

    for (const item of result.items) {
      await auditCartEvent(req, {
        eventType: "CART_ITEM_ADDED",
        action: "ADD_ITEM",
        resourceType: "CART_ITEM",
        cart: result.cart,
        item,
        changes: buildCartItemChanges(null, item),
      });
    }

    res.status(201).json(formatResponse(responseResult));
  } catch (error) {
    console.error("[createCart] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.addCartItem = async (req, res) => {
  try {
    const { userId } = req.params;
    const itemData = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (!itemData || Object.keys(itemData).length === 0) {
      return res.status(400).json({ error: "Item data is required" });
    }

    const existingCart = await cartDb.getCart(req.pool, userId);
    const dbData = toSnakeCase(itemData);
    const item = await cartDb.addCartItem(req.pool, userId, dbData);

    if (!existingCart) {
      await auditCartEvent(req, {
        eventType: "CART_CREATED",
        action: "CREATE",
        cart: { id: item.cart_id, user_id: userId },
        metadata: { createdImplicitly: true, itemCount: 1 },
      });
    }

    await auditCartEvent(req, {
      eventType: "CART_ITEM_ADDED",
      action: "ADD_ITEM",
      resourceType: "CART_ITEM",
      cart: { id: item.cart_id, user_id: userId },
      item,
      changes: buildCartItemChanges(null, item),
    });

    res.status(201).json(formatResponse(item));
  } catch (error) {
    console.error("[addCartItem] Error:", error.message, error.stack);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { userId, itemId } = req.params;
    const updateData = req.body;

    if (!userId || !itemId) {
      return res.status(400).json({ error: "User ID and Item ID are required" });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Update data is required" });
    }

    const cart = await cartDb.getCart(req.pool, userId);
    const previousItem = findCartItem(cart, itemId);
    if (!previousItem) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const dbData = toSnakeCase(updateData);
    const item = await cartDb.updateCartItem(req.pool, itemId, dbData);

    await auditCartEvent(req, {
      eventType: "CART_ITEM_UPDATED",
      action: "UPDATE_ITEM",
      resourceType: "CART_ITEM",
      cart,
      item,
      changes: buildCartItemChanges(previousItem, item),
    });

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

    const cart = await cartDb.getCart(req.pool, userId);
    const item = findCartItem(cart, itemId);
    if (!item) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    const deleted = await cartDb.deleteCartItem(req.pool, itemId);

    if (!deleted) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    await auditCartEvent(req, {
      eventType: "CART_ITEM_REMOVED",
      action: "REMOVE_ITEM",
      resourceType: "CART_ITEM",
      cart,
      item,
      changes: buildCartItemChanges(item, null),
    });

    res.status(204).send();
  } catch (error) {
    console.error("[deleteCartItem] Error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
