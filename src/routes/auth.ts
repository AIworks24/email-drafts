import express from 'express';
import { microsoftGraphService } from '../services/microsoftGraph';
import { databaseService } from '../services/database';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Get app URLs based on environment
const getAppUrls = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // In production, both frontend and backend are served from the same domain
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : 'https://your-app-name.vercel.app'; // Update this with your actual Vercel app name
    
    return {
      backend: baseUrl,
      frontend: baseUrl, // Same URL for monolithic deployment
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

// Start OAuth flow
router.get('/microsoft/login/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    
    // Verify client exists
    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Get authorization URL
    const authUrl = microsoftGraphService.getAuthUrl(clientId);
    
    res.json({ 
      authUrl,
      message: 'Redirect user to this URL to authorize access',
      clientId,
    });
  } catch (error) {
    console.error('Error starting OAuth flow:', error);
    res.status(500).json({ error: 'Failed to start authorization' });
  }
});

// Handle OAuth callback
router.get('/microsoft/callback', async (req, res): Promise<void> => {
  try {
    const { code, state, error } = req.query;
    const appUrls = getAppUrls();

    if (error) {
      console.error('OAuth error:', error);
      res.redirect(`${appUrls.frontend}/?error=${encodeURIComponent(error as string)}`);
      return;
    }

    if (!code || !state) {
      console.error('Missing OAuth parameters');
      res.redirect(`${appUrls.frontend}/?error=missing_parameters`);
      return;
    }

    const clientId = state as string;

    try {
      console.log('Exchanging code for tokens...');
      
      // Exchange code for tokens
      const tokens = await microsoftGraphService.exchangeCodeForTokens(code as string);
      console.log('Tokens acquired successfully');
      
      // Get user profile
      const userProfile = await microsoftGraphService.getUserProfile(tokens.accessToken);
      console.log('User profile retrieved:', userProfile.displayName);
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (tokens.expiresIn * 1000));

      // Update client with tokens
      await databaseService.updateClientTokens(
        clientId,
        tokens.accessToken,
        tokens.refreshToken,
        expiresAt
      );
      console.log('Client tokens updated');

      // Try to set up webhook subscription (optional for basic functionality)
      try {
        const webhookUrl = `${appUrls.backend}/api/webhook/microsoft/${clientId}`;
        console.log('Setting up webhook:', webhookUrl);
        
        const subscriptionId = await microsoftGraphService.createWebhookSubscription(
          tokens.accessToken,
          webhookUrl
        );

        await databaseService.saveWebhookSubscription({
          clientId,
          subscriptionId,
          resource: 'me/messages',
          expirationTime: new Date(Date.now() + (24 * 60 * 60 * 1000)),
        });
        console.log('Webhook subscription created:', subscriptionId);
      } catch (webhookError) {
        console.error('Webhook setup failed (continuing anyway):', webhookError);
        // Don't fail the whole flow if webhook fails
      }

      // Success redirect
      console.log('OAuth flow completed successfully');
      res.redirect(`${appUrls.frontend}/?client=${clientId}&connected=true`);

    } catch (tokenError) {
      console.error('Token exchange failed:', tokenError);
      res.redirect(`${appUrls.frontend}/?error=token_exchange_failed`);
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    const appUrls = getAppUrls();
    res.redirect(`${appUrls.frontend}/?error=callback_failed`);
  }
});

// Get client status
router.get('/status/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    
    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const isConnected = !!(client.accessToken && client.refreshToken);
    const tokenExpired = client.tokenExpiry ? new Date() > client.tokenExpiry : true;

    res.json({
      clientId,
      name: client.name,
      email: client.email,
      companyName: client.companyName,
      isConnected,
      tokenExpired,
      tokenExpiry: client.tokenExpiry,
      isActive: client.isActive,
    });
  } catch (error) {
    console.error('Error getting client status:', error);
    res.status(500).json({ error: 'Failed to get client status' });
  }
});

// Refresh client tokens
router.post('/microsoft/refresh/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    
    const client = await databaseService.getClientById(clientId);
    if (!client || !client.refreshToken) {
      res.status(404).json({ error: 'Client not found or no refresh token' });
      return;
    }

    // Refresh tokens
    const tokens = await microsoftGraphService.refreshToken(client.refreshToken);
    
    // Update client with new tokens
    const expiresAt = new Date(Date.now() + (tokens.expiresIn * 1000));
    await databaseService.updateClientTokens(
      clientId,
      tokens.accessToken,
      tokens.refreshToken,
      expiresAt
    );

    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      expiresAt,
    });

  } catch (error) {
    console.error('Error refreshing tokens:', error);
    res.status(500).json({ error: 'Failed to refresh tokens' });
  }
});

// Disconnect Microsoft 365
router.post('/microsoft/disconnect/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    
    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Delete webhook subscriptions
    const subscriptions = await databaseService.getActiveWebhookSubscriptions();
    for (const subscription of subscriptions) {
      if (subscription.clientId === clientId && client.accessToken) {
        try {
          await microsoftGraphService.deleteWebhookSubscription(
            client.accessToken,
            subscription.subscriptionId
          );
          await databaseService.deactivateWebhookSubscription(subscription.subscriptionId);
        } catch (error) {
          console.error('Error deleting webhook subscription:', error);
        }
      }
    }

    // Clear tokens
    await databaseService.updateClientTokens(clientId, '', '', new Date());

    res.json({
      success: true,
      message: 'Microsoft 365 integration disconnected successfully',
    });

  } catch (error) {
    console.error('Error disconnecting Microsoft 365:', error);
    res.status(500).json({ error: 'Failed to disconnect Microsoft 365' });
  }
});

export default router;
