import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import supplierRoutes from './routes/suppliers.js';
import customerRoutes from './routes/customers.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import salesOrderRoutes from './routes/salesOrders.js';
import inventoryMovementRoutes from './routes/inventoryMovements.js';
import reportRoutes from './routes/reports.js';
import teamMemberRoutes from './routes/teamMembers.js';
import settingsRoutes from './routes/settings.js';
import activityLogRoutes from './routes/activityLogs.js';

dotenv.config();

const app = express();
const frontendOrigins = new Set((process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim()));

app.use(cors({
  origin(origin, callback) {
    const isLocalViteOrigin = origin && process.env.NODE_ENV !== 'production'
      && /^http:\/\/(localhost|127\.0\.0\.1):517\d$/.test(origin);

    if (!origin || frontendOrigins.has(origin) || isLocalViteOrigin) {
      return callback(null, true);
    }

    return callback(null, false);
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/inventory-movements', inventoryMovementRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/team-members', teamMemberRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity-logs', activityLogRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Final error handler: a malformed JSON body (or any unexpected error) gets a
// short JSON answer instead of the default Express HTML page with a stack trace.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }
  console.error('Unhandled error', err);
  return res.status(500).json({ message: 'Server error' });
});

export default app;
