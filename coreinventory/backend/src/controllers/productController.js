const { query } = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ── List Products (with stock totals) ─────────────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const { search, category_id, low_stock, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    const conditions = ['p.is_deleted = FALSE'];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`);
    }
    if (category_id) {
      params.push(category_id);
      conditions.push(`p.category_id = $${params.length}`);
    }

    const where = conditions.join(' AND ');

    const sql = `
      SELECT 
        p.id, p.name, p.sku, p.unit_of_measure, p.reorder_point, p.reorder_qty,
        p.description, p.created_at,
        c.name AS category_name,
        COALESCE(SUM(ss.qty_on_hand), 0) AS total_stock,
        CASE WHEN COALESCE(SUM(ss.qty_on_hand), 0) <= p.reorder_point THEN true ELSE false END AS is_low_stock
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
      WHERE ${where}
      GROUP BY p.id, p.name, p.sku, p.unit_of_measure, p.reorder_point, 
               p.reorder_qty, p.description, p.created_at, c.name
      ${low_stock === 'true' ? 'HAVING COALESCE(SUM(ss.qty_on_hand), 0) <= p.reorder_point' : ''}
      ORDER BY p.name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const countSql = `SELECT COUNT(*) FROM products p WHERE ${where}`;
    const [data, count] = await Promise.all([
      query(sql, params),
      query(countSql, params.slice(0, params.length - 2)),
    ]);

    res.json({
      success: true,
      data: data.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: parseInt(count.rows[0].count),
      },
    });
  } catch (err) { next(err); }
};

// ── Create Product ────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { name, sku, category_id, unit_of_measure, reorder_point, reorder_qty, description } = req.body;
    const { rows } = await query(
      `INSERT INTO products (name, sku, category_id, unit_of_measure, reorder_point, reorder_qty, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, sku, category_id, unit_of_measure, reorder_point, reorder_qty, description]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// ── Get single product with stock by location ─────────────────────────────────
exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: [product] } = await query(
      `SELECT p.*, c.name AS category_name 
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.is_deleted = FALSE`,
      [id]
    );
    if (!product) throw createError('Product not found', 404);

    const { rows: stock } = await query(
      `SELECT ss.qty_on_hand, l.name AS location_name, l.short_code, w.name AS warehouse_name
       FROM stock_snapshot ss
       JOIN locations l ON l.id = ss.location_id
       JOIN warehouses w ON w.id = l.warehouse_id
       WHERE ss.product_id = $1 AND ss.qty_on_hand > 0
       ORDER BY ss.qty_on_hand DESC`,
      [id]
    );

    res.json({ success: true, data: { ...product, stock_by_location: stock } });
  } catch (err) { next(err); }
};

// ── Update Product ────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, sku, category_id, unit_of_measure, reorder_point, reorder_qty, description } = req.body;

    const { rows } = await query(
      `UPDATE products SET name=$1, sku=$2, category_id=$3, unit_of_measure=$4,
       reorder_point=$5, reorder_qty=$6, description=$7 
       WHERE id=$8 AND is_deleted=FALSE RETURNING *`,
      [name, sku, category_id, unit_of_measure, reorder_point, reorder_qty, description, id]
    );
    if (!rows.length) throw createError('Product not found', 404);
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

// ── Soft Delete ───────────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      'UPDATE products SET is_deleted=TRUE WHERE id=$1 AND is_deleted=FALSE RETURNING id',
      [id]
    );
    if (!rows.length) throw createError('Product not found', 404);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { next(err); }
};

// ── Get all categories ────────────────────────────────────────────────────────
exports.listCategories = async (_req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM categories ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
