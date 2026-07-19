const { query } = require('../config/db');
const { createError } = require('../middleware/errorHandler');

exports.list = async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT w.*, COUNT(l.id) AS location_count
      FROM warehouses w
      LEFT JOIN locations l ON l.warehouse_id = w.id AND l.is_active = TRUE
      WHERE w.is_active = TRUE
      GROUP BY w.id ORDER BY w.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, short_code, address } = req.body;
    const { rows } = await query(
      'INSERT INTO warehouses (name,short_code,address) VALUES($1,$2,$3) RETURNING *',
      [name, short_code, address]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

exports.getLocations = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT l.*, 
       COALESCE(SUM(ss.qty_on_hand),0) AS total_stock,
       COUNT(DISTINCT ss.product_id) AS distinct_products
       FROM locations l
       LEFT JOIN stock_snapshot ss ON ss.location_id = l.id
       WHERE l.warehouse_id = $1 AND l.is_active = TRUE
       GROUP BY l.id ORDER BY l.name`,
      [id]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.createLocation = async (req, res, next) => {
  try {
    const { warehouse_id, name, short_code, parent_id } = req.body;
    const { rows } = await query(
      'INSERT INTO locations (warehouse_id,name,short_code,parent_id) VALUES($1,$2,$3,$4) RETURNING *',
      [warehouse_id, name, short_code, parent_id || null]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

exports.listAllLocations = async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT l.id, l.name, l.short_code, l.warehouse_id, w.name AS warehouse_name
      FROM locations l JOIN warehouses w ON w.id = l.warehouse_id
      WHERE l.is_active = TRUE AND w.is_active = TRUE
      ORDER BY w.name, l.name
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
