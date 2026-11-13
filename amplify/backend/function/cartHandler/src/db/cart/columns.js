// Cart columns a customer may set. Keys come from the request body, so every
// cart query keeps only these (see /opt/nodejs/utils/sqlColumns).

// What the Customer App sends when adding an item (useCart.addToCart).
const CART_ITEM_INSERT_COLUMNS = [
  "product_id",
  "variant_id",
  "product_name",
  "variant_title",
  "price",
  "currency_code",
  "quantity",
  "minimum_order_quantity",
  "minimum_order_value",
  "total_inventory",
  "selected_option",
  "image",
];

// The Customer App only ever changes the quantity of an item in the cart.
const CART_ITEM_UPDATE_COLUMNS = ["quantity"];

module.exports = { CART_ITEM_INSERT_COLUMNS, CART_ITEM_UPDATE_COLUMNS };
