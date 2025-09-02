import express from 'express';
import { microsoftGraphService } from '../services/microsoftGraph';
import { databaseService } from '../services/database';
import jwt from 'jsonwebtoken';

const router = express.Router();

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

    if (error) {
      res.status(400).json({ error: 'Authorization denied', details: error });
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing authorization code or state' });
      return;
    }

    const clientId = state as string;

    // Exchange code for tokens
    const tokens = await microsoftGraphService.exchangeCodeForTokens(code as string);
    
    // Get user profile
    const userProfile = await microsoftGraphService.getUserProfile(tokens.accessToken);
    
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (tokens.expiresIn * 1000));

    // Update client with tokens
    await databaseService.updateClientTokens(
      clientId,
      tokens.accessToken,
      tokens.refreshToken,
      expiresAt
    );

    // Set up webhook subscription
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/api/webhook/microsoft/${clientId}`;
    const subscriptionId = await microsoftGraphService.createWebhookSubscription(
      tokens.accessToken,
      webhookUrl
    );

    // Save webhook subscription
    await databaseService.saveWebhookSubscription({
      clientId,
      subscriptionId,
      resource: 'me/messages',
      expirationTime: new Date(Date.now() + (24 * 60 * 60 * 1000)), // 24 hours
    });

    // Generate JWT for client
    const jwtToken = jwt.sign(
      { clientId, email: userProfile.mail || userProfile.userPrincipalName },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Microsoft 365 integration completed successfully',
      user: {
        name: userProfile.displayName,
        email: userProfile.mail || userProfile.userPrincipalName,
      },
      token: jwtToken,
      webhookSubscription: subscriptionId,
    });

  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(500).json({ error: 'Failed to complete authorization' });
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