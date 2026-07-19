const { z } = require('zod');

// ─── Auth ─────────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  name:     z.string().min(2).max(120),
  email:    z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Must contain uppercase')
                             .regex(/[0-9]/, 'Must contain a number'),
  role:     z.enum(['admin', 'manager', 'staff']).optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email:    z.string().email(),
  otp:      z.string().length(6),
  password: z.string().min(8),
});

// ─── Products ─────────────────────────────────────────────────────────────────
const productSchema = z.object({
  name:            z.string().min(2).max(200),
  sku:             z.string().min(2).max(80).toUpperCase(),
  category_id:     z.string().uuid().optional().nullable(),
  unit_of_measure: z.string().min(1).max(30).default('pcs'),
  reorder_point:   z.number().min(0).default(0),
  reorder_qty:     z.number().min(0).default(0),
  description:     z.string().max(1000).optional().nullable(),
});

// ─── Warehouses ───────────────────────────────────────────────────────────────
const warehouseSchema = z.object({
  name:       z.string().min(2).max(120),
  short_code: z.string().min(2).max(20).toUpperCase(),
  address:    z.string().max(500).optional().nullable(),
});

// ─── Locations ────────────────────────────────────────────────────────────────
const locationSchema = z.object({
  warehouse_id: z.string().uuid(),
  name:         z.string().min(2).max(120),
  short_code:   z.string().min(1).max(20).toUpperCase(),
  parent_id:    z.string().uuid().optional().nullable(),
});

// ─── Receipts / Deliveries / Transfers ────────────────────────────────────────
const stockMoveSchema = z.object({
  type:          z.enum(['receipt', 'delivery', 'internal', 'adjustment']),
  product_id:    z.string().uuid(),
  from_location: z.string().uuid().optional().nullable(),
  to_location:   z.string().uuid().optional().nullable(),
  qty_planned:   z.number().positive(),
  supplier:      z.string().max(200).optional().nullable(),
  customer:      z.string().max(200).optional().nullable(),
  notes:         z.string().max(1000).optional().nullable(),
}).refine(data => {
  if (data.type === 'receipt')    return !!data.to_location;
  if (data.type === 'delivery')   return !!data.from_location;
  if (data.type === 'internal')   return !!data.from_location && !!data.to_location;
  if (data.type === 'adjustment') return !!data.to_location || !!data.from_location;
  return true;
}, { message: 'Location requirements not met for this operation type' });

// ─── Stock Adjustment ─────────────────────────────────────────────────────────
const adjustmentSchema = z.object({
  product_id:  z.string().uuid(),
  location_id: z.string().uuid(),
  new_qty:     z.number().min(0),
  notes:       z.string().max(500).optional(),
});

// ─── Middleware factory ───────────────────────────────────────────────────────
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: result.error.errors.map(e => ({
        field:   e.path.join('.'),
        message: e.message,
      })),
    });
  }
  req.body = result.data; // use coerced/transformed data
  next();
};

module.exports = {
  validate,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  productSchema,
  warehouseSchema,
  locationSchema,
  stockMoveSchema,
  adjustmentSchema,
};
