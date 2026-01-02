select * from dev.addresses a 

------------- cart table---------------
CREATE TABLE dev.carts (
    cart_id           BIGSERIAL  PRIMARY KEY ,
    user_id           VARCHAR(120)  NULL, -- FK to users table (nullable for guest carts)
    status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE | CHECKED_OUT | ABANDONED
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMP NULL
);

CREATE UNIQUE INDEX ux_cart_active_user
ON dev.carts(user_id)
WHERE status = 'ACTIVE';

commit;

CREATE TABLE prod.carts (
    cart_id           BIGSERIAL  PRIMARY KEY ,
    user_id           VARCHAR(120)   NULL, -- FK to users table (nullable for guest carts)
    status            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    -- ACTIVE | CHECKED_OUT | ABANDONED
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMP NULL
);

CREATE UNIQUE INDEX ux_cart_active_user
ON prod.carts(user_id)
WHERE status = 'ACTIVE';

commit;

------------- cart item table---------------

CREATE TABLE dev.cart_items (
    cart_item_id      BIGSERIAL  PRIMARY KEY ,
    cart_id           BIGINT   NOT NULL,
    product_id        BIGINT   NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_price        NUMERIC(12,2) NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cart
        FOREIGN KEY (cart_id)
        REFERENCES dev.carts(cart_id)
        ON DELETE CASCADE,

    CONSTRAINT ux_cart_product
        UNIQUE (cart_id, product_id)
);

CREATE TABLE prod.cart_items (
    cart_item_id      BIGSERIAL PRIMARY KEY,
    cart_id           BIGINT NOT NULL,
    product_id        BIGINT NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_price        NUMERIC(12,2) NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cart
        FOREIGN KEY (cart_id)
        REFERENCES prod.carts(cart_id)
        ON DELETE CASCADE,

    CONSTRAINT ux_cart_product
        UNIQUE (cart_id, product_id)
);


------------- order table---------------

CREATE TABLE dev.orders (
    order_id          BIGSERIAL PRIMARY KEY ,
    cart_id           BIGINT NOT NULL,
    user_id           BIGINT NOT NULL,
    order_number      VARCHAR(30) UNIQUE NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | PAID | SHIPPED | CANCELLED | COMPLETED
    pay_method        VARCHAR(20) NOT NULL DEFAULT 'BANK_TRANSFER',

    total_amount      NUMERIC(12,2) NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_cart
        FOREIGN KEY (cart_id)
        REFERENCES dev.carts(cart_id)
);

CREATE UNIQUE INDEX ux_order_cart
ON dev.orders(cart_id);

commit; 

CREATE TABLE prod.orders (
    order_id          BIGSERIAL PRIMARY KEY ,
    cart_id           BIGINT NOT NULL,
    user_id           BIGINT NOT NULL,
    order_number      VARCHAR(30) UNIQUE NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | PAID | SHIPPED | CANCELLED | COMPLETED

    total_amount      NUMERIC(12,2) NOT NULL,
    pay_method        VARCHAR(20) NOT NULL DEFAULT 'BANK_TRANSFER',
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order_cart
        FOREIGN KEY (cart_id)
        REFERENCES prod.carts(cart_id)
);

CREATE UNIQUE INDEX ux_order_cart
ON prod.orders(cart_id);


------------- order item  table---------------

CREATE TABLE dev.order_items (
    order_item_id     BIGSERIAL PRIMARY KEY ,
    order_id          BIGINT NOT NULL,
    product_id        BIGINT NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_price        NUMERIC(12,2) NOT NULL,
    total_price       NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order
        FOREIGN KEY (order_id)
        REFERENCES dev.orders(order_id)
        ON DELETE CASCADE
);

CREATE TABLE prod.order_items (
    order_item_id     BIGSERIAL PRIMARY KEY ,
    order_id          BIGINT NOT NULL,
    product_id        BIGINT NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0),
    unit_price        NUMERIC(12,2) NOT NULL,
    total_price       NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_order
        FOREIGN KEY (order_id)
        REFERENCES prod.orders(order_id)
        ON DELETE CASCADE
);

commit;

CREATE INDEX idx_cart_user ON dev.carts(user_id);
CREATE INDEX idx_cart_items_cart ON dev.cart_items(cart_id);
CREATE INDEX idx_orders_user ON dev.orders(user_id);
CREATE INDEX idx_order_items_order ON dev.order_items(order_id);

CREATE INDEX idx_cart_user ON prod.carts(user_id);
CREATE INDEX idx_cart_items_cart ON prod.cart_items(cart_id);
CREATE INDEX idx_orders_user ON prod.orders(user_id);
CREATE INDEX idx_order_items_order ON prod.order_items(order_id);
commit;

ALTER TABLE dev.orders
ALTER COLUMN user_id TYPE VARCHAR(120)
USING user_id::VARCHAR;

ALTER TABLE prod.orders
ALTER COLUMN user_id TYPE VARCHAR(120)
USING user_id::VARCHAR;


commit;
