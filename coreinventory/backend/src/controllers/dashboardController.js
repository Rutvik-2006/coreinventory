const { query } = require('../config/db');

exports.kpis = async (req, res, next) => {
  try {
    const [
      products,
      lowStock,
      pendingReceipts,
      pendingDeliveries,
      pendingTransfers,
      recentMoves,
    ] = await Promise.all([
      // Total active products
      query("SELECT COUNT(*) AS count FROM products WHERE is_deleted = FALSE"),

      // Low stock products
      query(`
        SELECT COUNT(*) AS count FROM (
          SELECT p.id, COALESCE(SUM(ss.qty_on_hand),0) AS total_stock, p.reorder_point
          FROM products p
          LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
          WHERE p.is_deleted = FALSE
          GROUP BY p.id, p.reorder_point
          HAVING COALESCE(SUM(ss.qty_on_hand),0) <= p.reorder_point
        ) t
      `),

      // Pending receipts (draft/waiting/ready)
      query(`SELECT COUNT(*) AS count FROM stock_moves 
             WHERE type='receipt' AND status IN ('draft','waiting','ready')`),

      // Pending deliveries
      query(`SELECT COUNT(*) AS count FROM stock_moves 
             WHERE type='delivery' AND status IN ('draft','waiting','ready')`),

      // Pending internal transfers
      query(`SELECT COUNT(*) AS count FROM stock_moves 
             WHERE type='internal' AND status IN ('draft','waiting','ready')`),

      // Recent 10 moves for activity feed
      query(`
        SELECT sm.reference, sm.type, sm.status, sm.qty_planned, sm.created_at,
               p.name AS product_name, p.unit_of_measure
        FROM stock_moves sm
        JOIN products p ON p.id = sm.product_id
        ORDER BY sm.created_at DESC LIMIT 10
      `),
    ]);

    res.json({
      success: true,
      data: {
        total_products:     parseInt(products.rows[0].count),
        low_stock_count:    parseInt(lowStock.rows[0].count),
        pending_receipts:   parseInt(pendingReceipts.rows[0].count),
        pending_deliveries: parseInt(pendingDeliveries.rows[0].count),
        pending_transfers:  parseInt(pendingTransfers.rows[0].count),
        recent_activity:    recentMoves.rows,
      },
    });
  } catch (err) { next(err); }
};

// Stock by warehouse overview
exports.stockOverview = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT 
        w.name AS warehouse_name, w.short_code,
        COUNT(DISTINCT ss.product_id) AS distinct_products,
        SUM(ss.qty_on_hand) AS total_units
      FROM warehouses w
      JOIN locations l ON l.warehouse_id = w.id
      JOIN stock_snapshot ss ON ss.location_id = l.id
      WHERE ss.qty_on_hand > 0
      GROUP BY w.id, w.name, w.short_code
      ORDER BY w.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
