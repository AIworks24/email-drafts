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

// Get environment-specific URLs
const getAppUrls = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return {
      backend: process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}`
        : 'https://email-drafts-backend.vercel.app',
      frontend: 'https://email-drafts-frontend.vercel.app',
    };
  }
  
  // Development/Codespaces
  const codespaceName = process.env.CODESPACE_NAME;
  if (codespaceName) {
    return {
      backend: `https://${codespaceName}-3000.preview.app.github.dev`,
      frontend: `https://${codespaceName}-3001.preview.app.github.dev`,
    };
  }
  
  // Local development
  return {
    backend: 'http://localhost:3000',
    frontend: 'http://localhost:3001',
  };
};

const appUrls = getAppUrls();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://graph.microsoft.com", "https://login.microsoftonline.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: [
    appUrls.frontend,
    'http://localhost:3001',
    /^https:\/\/.*-3001\.preview\.app\.github\.dev$/, // Codespaces
    /^https:\/\/.*\.vercel\.app$/, // All Vercel apps
  ],
  credentials: false, // Set to false for production CORS
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/client', clientRoutes);

// Serve frontend in production - catch-all route
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'API route not found' });
      return;
    }
    res.sendFile('index.html', { root: 'frontend/dist' });
  });
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await databaseService.testConnection();
    
    res.json({ 
      status: dbHealthy ? 'OK' : 'ERROR',
      database: dbHealthy ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
      service: 'AI Email Drafts Agent',
      environment: process.env.NODE_ENV || 'development',
      urls: appUrls,
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug endpoint for checking configuration
app.get('/debug-config', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV || 'development',
    urls: appUrls,
    azure: {
      clientId: process.env.AZURE_CLIENT_ID ? '***configured***' : 'missing',
      redirectUri: process.env.AZURE_REDIRECT_URI || 'not set',
    },
    database: process.env.DATABASE_URL ? '***configured***' : 'missing',
    jwt: process.env.JWT_SECRET ? '***configured***' : 'missing',
  });
});

// Basic endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'AI Email Drafts Agent API',
    version: '1.0.0',
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
  });
});

// Test database operations (remove in production)
app.get('/test-db', async (req, res) => {
  try {
    const testClient = await databaseService.createClient({
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      companyName: 'Test Company',
      tenantId: 'test-tenant-' + Date.now(),
    });

    // Clean up test client
    await databaseService.getPrisma().client.delete({
      where: { id: testClient.id }
    });

    res.json({
      message: 'Database operations working!',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Database operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({ 
    error: 'Server error occurred',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 AI Email Drafts Agent running on port ${PORT}`);
    console.log(`📊 Health check: ${appUrls.backend}/health`);
    console.log(`🔧 Debug config: ${appUrls.backend}/debug-config`);
  });
}

export default app;
