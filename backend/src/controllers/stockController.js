const { query, getClient } = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ── List moves with filters ───────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { type, status, warehouse_id, product_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = [];

    if (type)        { params.push(type);        conditions.push(`sm.type = $${params.length}`); }
    if (status)      { params.push(status);      conditions.push(`sm.status = $${params.length}`); }
    if (product_id)  { params.push(product_id);  conditions.push(`sm.product_id = $${params.length}`); }
    if (warehouse_id) {
      params.push(warehouse_id);
      conditions.push(`(fl.warehouse_id = $${params.length} OR tl.warehouse_id = $${params.length})`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const sql = `
      SELECT 
        sm.id, sm.reference, sm.type, sm.status, sm.direction,
        sm.qty_planned, sm.qty_done, sm.supplier, sm.customer,
        sm.notes, sm.done_at, sm.created_at,
        p.name AS product_name, p.sku, p.unit_of_measure,
        fl.name AS from_location_name, fl.short_code AS from_code,
        tl.name AS to_location_name, tl.short_code AS to_code,
        fw.name AS from_warehouse, tw.name AS to_warehouse,
        u.name AS created_by_name
      FROM stock_moves sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN locations fl ON fl.id = sm.from_location
      LEFT JOIN locations tl ON tl.id = sm.to_location
      LEFT JOIN warehouses fw ON fw.id = fl.warehouse_id
      LEFT JOIN warehouses tw ON tw.id = tl.warehouse_id
      JOIN users u ON u.id = sm.created_by
      ${where}
      ORDER BY sm.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const countSql = `
      SELECT COUNT(*) FROM stock_moves sm
      LEFT JOIN locations fl ON fl.id = sm.from_location
      LEFT JOIN locations tl ON tl.id = sm.to_location
      ${where}
    `;

    const [data, count] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, -2)),
    ]);

    res.json({
      success: true,
      data: data.rows,
      pagination: { page: Number(page), limit: Number(limit), total: parseInt(count.rows[0].count) },
    });
  } catch (err) { next(err); }
};

// ── Create a new stock move ───────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const {
      type, product_id, from_location, to_location,
      qty_planned, supplier, customer, notes
    } = req.body;

    const direction = type === 'receipt' ? 'in'
                    : type === 'delivery' ? 'out'
                    : type === 'internal' ? 'internal'
                    : (qty_planned >= 0 ? 'in' : 'out');  // adjustment

    // Generate reference via DB function
    const { rows: refRow } = await query(
      'SELECT generate_reference($1::move_type) AS ref', [type]
    );
    const reference = refRow[0].ref;

    const { rows } = await query(
      `INSERT INTO stock_moves 
        (reference, type, status, direction, product_id, from_location, to_location,
         qty_planned, supplier, customer, notes, created_by)
       VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [reference, type, direction, product_id, from_location || null, to_location || null,
       qty_planned, supplier || null, customer || null, notes || null, req.user.id]
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// ── Validate (mark as done) — updates stock atomically ───────────────────────
exports.validate = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { qty_done } = req.body;

    const { rows: [move] } = await client.query(
      'SELECT * FROM stock_moves WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (!move) throw createError('Move not found', 404);
    if (move.status === 'done')      throw createError('Move already validated', 400);
    if (move.status === 'cancelled') throw createError('Cannot validate a cancelled move', 400);

    const finalQty = qty_done ?? move.qty_planned;

    // For deliveries: check available stock
    if (move.direction === 'out' || move.direction === 'internal') {
      const { rows: [snap] } = await client.query(
        'SELECT qty_on_hand FROM stock_snapshot WHERE product_id=$1 AND location_id=$2',
        [move.product_id, move.from_location]
      );
      const available = snap?.qty_on_hand ?? 0;
      if (available < finalQty) {
        throw createError(`Insufficient stock. Available: ${available}, Requested: ${finalQty}`, 400);
      }
    }

    // Update the move
    const { rows: [updated] } = await client.query(
      `UPDATE stock_moves SET status='done', qty_done=$1, done_at=NOW()
       WHERE id=$2 RETURNING *`,
      [finalQty, id]
    );

    // Update stock snapshot via DB function
    await client.query(
      'SELECT update_stock_snapshot($1, $2, $3, $4, $5::move_direction)',
      [move.product_id, move.from_location, move.to_location, finalQty, move.direction]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_log (table_name, record_id, action, new_data, performed_by)
       VALUES ('stock_moves', $1, 'VALIDATE', $2, $3)`,
      [id, JSON.stringify(updated), req.user.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// ── Cancel a move ─────────────────────────────────────────────────────────────
exports.cancel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [move] } = await query('SELECT status FROM stock_moves WHERE id=$1', [id]);
    if (!move) throw createError('Move not found', 404);
    if (move.status === 'done') throw createError('Cannot cancel a validated move', 400);

    const { rows: [updated] } = await query(
      `UPDATE stock_moves SET status='cancelled' WHERE id=$1 RETURNING *`, [id]
    );
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

// ── Get single move ───────────────────────────────────────────────────────────
exports.getById = async (req, res, next) => {
  try {
    const { rows: [move] } = await query(
      `SELECT sm.*, p.name AS product_name, p.sku, p.unit_of_measure,
       fl.name AS from_location_name, tl.name AS to_location_name,
       fw.name AS from_warehouse, tw.name AS to_warehouse,
       u.name AS created_by_name
       FROM stock_moves sm
       JOIN products p ON p.id = sm.product_id
       LEFT JOIN locations fl ON fl.id = sm.from_location
       LEFT JOIN locations tl ON tl.id = sm.to_location
       LEFT JOIN warehouses fw ON fw.id = fl.warehouse_id
       LEFT JOIN warehouses tw ON tw.id = tl.warehouse_id
       JOIN users u ON u.id = sm.created_by
       WHERE sm.id = $1`,
      [req.params.id]
    );
    if (!move) throw createError('Move not found', 404);
    res.json({ success: true, data: move });
  } catch (err) { next(err); }
};

// ── Stock Adjustment ──────────────────────────────────────────────────────────
exports.adjust = async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { product_id, location_id, new_qty, notes } = req.body;

    const { rows: [snap] } = await client.query(
      'SELECT qty_on_hand FROM stock_snapshot WHERE product_id=$1 AND location_id=$2',
      [product_id, location_id]
    );
    const current = snap?.qty_on_hand ?? 0;
    const diff = new_qty - current;
    if (diff === 0) {
      await client.query('ROLLBACK');
      return res.json({ success: true, message: 'No change required' });
    }

    const direction = diff > 0 ? 'in' : 'out';
    const qty = Math.abs(diff);

    const { rows: refRow } = await client.query(
      "SELECT generate_reference('adjustment'::move_type) AS ref"
    );
    const reference = refRow[0].ref;

    const { rows: [move] } = await client.query(
      `INSERT INTO stock_moves
        (reference, type, status, direction, product_id, from_location, to_location,
         qty_planned, qty_done, notes, done_at, created_by)
       VALUES ($1,'adjustment','done',$2,$3,$4,$5,$6,$6,$7,NOW(),$8) RETURNING *`,
      [reference, direction, product_id,
       direction === 'out' ? location_id : null,
       direction === 'in'  ? location_id : null,
       qty, notes || 'Manual adjustment', req.user.id]
    );

    // Update snapshot directly
    await client.query(
      `INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, location_id)
       DO UPDATE SET qty_on_hand = $3, updated_at = NOW()`,
      [product_id, location_id, new_qty]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: move });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};
