import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import categoryRoutes from './routes/categories.js';
import supplierRoutes from './routes/suppliers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
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

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
