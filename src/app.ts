import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { databaseService } from './services/database';

// Import routes
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhook';
import clientRoutes from './routes/client';

// Import middleware
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3001', 'https://*-3001.preview.app.github.dev'],
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes); // No auth needed for webhooks
app.use('/api/client', clientRoutes); // Some routes have optional auth

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbHealthy = await databaseService.testConnection();
  
  res.json({ 
    status: dbHealthy ? 'OK' : 'ERROR',
    database: dbHealthy ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    service: 'AI Email Drafts Agent'
  });
});

// Basic test endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'AI Email Drafts Agent API',
    version: '1.0.0'
  });
});

// Test database operations
app.get('/test-db', async (req, res) => {
  try {
    // Test creating a client (you can delete this later)
    const testClient = await databaseService.createClient({
      email: 'test@example.com',
      name: 'Test User',
      companyName: 'Test Company',
      tenantId: 'test-tenant-' + Date.now(),
    });

    res.json({
      message: 'Database operations working!',
      testClient: {
        id: testClient.id,
        email: testClient.email,
        name: testClient.name
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AI Email Drafts Agent running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;