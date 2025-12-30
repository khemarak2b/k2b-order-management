const getOrder = async (pool, id) => {
     const client = await pool.connect();
     const schema = process.env.ENVIRONMENT || 'dev';
     
     try {
         // Get product
         /*
         const productResult = await client.query(
             `SELECT * FROM ${schema}.products WHERE id = $1`,
             [id]
         );
         
         if (productResult.rows.length === 0) {
             return null;
         }
         
         const product = productResult.rows[0];
         
         // Get variants with inventory and media
         const variantsResult = await client.query(
             `SELECT pv.id, pv.product_id, pv.shopify_variant_id, pv.title, pv.sku, pv.price, 
                     pv.currency_code, pv.compare_at_price, pv.barcode, pv.position, 
                     pv.inventory_policy, pv.tracked, pv.shopify_inventory_item_id, 
                     pv.selected_options, pv.created_at, pv.updated_at,
                     json_agg(json_build_object('location_name', pvil.location_name, 'quantity', pvil.quantity, 'shopify_location_id', pvil.shopify_location_id)) FILTER (WHERE pvil.id IS NOT NULL) as inventory_levels,
                     json_agg(json_build_object('id', pvm.id, 'shopify_media_id', pvm.shopify_media_id, 'media_type', pvm.media_type, 'url', pvm.url, 'alt_text', pvm.alt_text, 'width', pvm.width, 'height', pvm.height)) FILTER (WHERE pvm.id IS NOT NULL) as media
              FROM ${schema}.product_variants pv
              LEFT JOIN ${schema}.product_variant_inventory_levels pvil ON pv.id = pvil.variant_id
              LEFT JOIN ${schema}.product_variant_media pvm ON pv.id = pvm.variant_id
              WHERE pv.product_id = $1
              GROUP BY pv.id
              ORDER BY pv.id ASC`,
             [id]
         );
         
         // Get collections
         const collectionsResult = await client.query(
             `SELECT pc.id, pc.shopify_collection_id, pc.title, pc.handle
              FROM ${schema}.product_collection_links pcl
              JOIN ${schema}.product_collections pc ON pcl.collection_id = pc.id
              WHERE pcl.product_id = $1
              ORDER BY pc.title ASC`,
             [id]
         );
         
         // Get product media
         const mediaResult = await client.query(
             `SELECT id, shopify_media_id, media_type, url, alt_text, width, height
              FROM ${schema}.product_media
              WHERE product_id = $1
              ORDER BY id ASC`,
             [id]
         );
         
         return {
             ...product,
             variants: variantsResult.rows,
             collections: collectionsResult.rows,
             media: mediaResult.rows
         };
         */
         return {};
     } finally {
         client.release();
     }
 };
 
 module.exports = getOrder;
