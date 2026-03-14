const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { validate, registerSchema, loginSchema, forgotPasswordSchema, 
        resetPasswordSchema, productSchema, warehouseSchema, locationSchema,
        stockMoveSchema, adjustmentSchema } = require('../validators');

const auth      = require('../controllers/authController');
const products  = require('../controllers/productController');
const stock     = require('../controllers/stockController');
const warehouse = require('../controllers/warehouseController');
const dashboard = require('../controllers/dashboardController');

// ── Auth (public) ─────────────────────────────────────────────────────────────
router.post('/auth/register',       validate(registerSchema),       auth.register);
router.post('/auth/login',          validate(loginSchema),          auth.login);
router.post('/auth/forgot-password',validate(forgotPasswordSchema), auth.forgotPassword);
router.post('/auth/reset-password', validate(resetPasswordSchema),  auth.resetPassword);
router.get ('/auth/me',             authenticate,                   auth.me);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/dashboard/kpis',     authenticate, dashboard.kpis);
router.get('/dashboard/overview', authenticate, dashboard.stockOverview);

// ── Products ──────────────────────────────────────────────────────────────────
router.get ('/products',            authenticate, products.list);
router.post('/products',            authenticate, authorize('admin','manager'), validate(productSchema), products.create);
router.get ('/products/categories', authenticate, products.listCategories);
router.get ('/products/:id',        authenticate, products.getById);
router.put ('/products/:id',        authenticate, authorize('admin','manager'), validate(productSchema), products.update);
router.delete('/products/:id',      authenticate, authorize('admin'),           products.remove);

// ── Stock Moves (Receipts, Deliveries, Transfers, History) ────────────────────
router.get ('/moves',              authenticate, stock.list);
router.post('/moves',              authenticate, validate(stockMoveSchema), stock.create);
router.get ('/moves/:id',          authenticate, stock.getById);
router.post('/moves/:id/validate', authenticate, stock.validate);
router.post('/moves/:id/cancel',   authenticate, authorize('admin','manager'), stock.cancel);

// ── Stock Adjustment ──────────────────────────────────────────────────────────
router.post('/stock/adjust', authenticate, authorize('admin','manager'), validate(adjustmentSchema), stock.adjust);

// ── Warehouses ────────────────────────────────────────────────────────────────
router.get ('/warehouses',                   authenticate, warehouse.list);
router.post('/warehouses',                   authenticate, authorize('admin'), validate(warehouseSchema), warehouse.create);
router.get ('/warehouses/locations',         authenticate, warehouse.listAllLocations);
router.get ('/warehouses/:id/locations',     authenticate, warehouse.getLocations);
router.post('/warehouses/:id/locations',     authenticate, authorize('admin','manager'), validate(locationSchema), warehouse.createLocation);

module.exports = router;
