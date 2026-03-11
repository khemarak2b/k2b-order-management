# Tracking Number & URL Implementation

## Summary
Added tracking number and tracking URL fields to the orders system, allowing admins to add carrier tracking information that customers can view.

## Changes Made

### 1. Database Migration
**File**: `scripts/migrations/003-add-tracking-fields.sql`

Adds two columns to both `dev` and `prod` schemas:
- `tracking_number VARCHAR(100)` - Carrier tracking number (e.g., "1Z999AA10123456784")
- `tracking_url TEXT` - Direct link to carrier tracking page

Creates indexes for efficient lookup by tracking number.

### 2. Admin API Enhancement
**File**: `amplify/backend/function/adminOrdersHandler/src/controllers/orderController.js`

Updated `updateOrder` endpoint to:
- Accept `trackingNumber` and `trackingUrl` in request body
- Validate tracking URL format (must be valid URL)
- Pass through to database layer via generic UPDATE mechanism

### 3. Database Layer
No changes needed - existing `updateOrder.js` uses dynamic field mapping:
- Converts all provided fields to snake_case
- Dynamically builds UPDATE query
- Automatically supports new columns

### 4. Customer-Facing API
No changes needed - existing endpoints automatically return new fields:
- `GET /orders/:id` includes `trackingNumber` and `trackingUrl`
- `GET /orders/user/:userId` includes tracking data
- Response formatting automatically converts snake_case to camelCase

## Usage

### Admin adds tracking info
```bash
PUT /admin-orders/:orderId
Content-Type: application/json

{
  "status": "shipped",
  "trackingNumber": "1Z999AA10123456784",
  "trackingUrl": "https://tracking.ups.com/track?tracknum=1Z999AA10123456784"
}
```

### Customer views tracking
```bash
GET /orders/:orderId
```

Response includes:
```json
{
  "id": 123,
  "orderNumber": "ORD-001234",
  "status": "shipped",
  "trackingNumber": "1Z999AA10123456784",
  "trackingUrl": "https://tracking.ups.com/track?tracknum=1Z999AA10123456784",
  "totalAmount": 150.50,
  ...
}
```

## Deployment

1. Run migration: `psql -U postgres -d k2b -f scripts/migrations/003-add-tracking-fields.sql`
2. Deploy updated Lambda functions
3. No frontend changes needed - tracking data is automatically included in responses

## Notes

- Tracking fields are optional (can be NULL)
- URL validation prevents invalid tracking links
- Both admin and customer routes support the new fields
- No status transition changes - tracking can be added at any stage
