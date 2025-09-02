import { Client } from '@microsoft/microsoft-graph-client';
import { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface EmailData {
  id: string;
  subject: string;
  body: string;
  sender: {
    name: string;
    email: string;
  };
  recipients: Array<{
    name: string;
    email: string;
  }>;
  receivedDateTime: string;
  conversationId: string;
}

interface DraftResponse {
  id: string;
  subject: string;
  body: string;
}

class CustomAuthProvider implements AuthenticationProvider {
  constructor(private accessToken: string) {}

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

class MicrosoftGraphService {
  private clientApp: ConfidentialClientApplication;
  private baseUrl = 'https://graph.microsoft.com/v1.0';

  constructor() {
    this.clientApp = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
      },
    });
  }

  // OAuth Flow - Get authorization URL
  getAuthUrl(clientId: string): string {
    const scopes = [
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/User.Read',
    ];

    const authCodeUrlParameters = {
      scopes: scopes,
      redirectUri: process.env.AZURE_REDIRECT_URI!,
      state: clientId, // Pass client ID as state for tracking
    };

    // This is actually synchronous despite the interface
    return this.clientApp.getAuthCodeUrl(authCodeUrlParameters) as any;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    try {
      const tokenRequest = {
        code: code,
        scopes: [
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/User.Read',
        ],
        redirectUri: process.env.AZURE_REDIRECT_URI!,
      };

      const response = await this.clientApp.acquireTokenByCode(tokenRequest);
      
      if (!response) {
        throw new Error('Failed to acquire token');
      }

      // MSAL doesn't provide refresh tokens in the same way - we'll handle this differently
      return {
        accessToken: response.accessToken,
        refreshToken: response.account?.homeAccountId || '', // Use account ID for refresh
        expiresIn: response.expiresOn ? 
          Math.floor((response.expiresOn.getTime() - Date.now()) / 1000) : 3600,
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  // Refresh access token - simplified approach using silent token acquisition
  async refreshToken(accountId: string): Promise<TokenResponse> {
    try {
      const silentRequest = {
        scopes: [
          'https://graph.microsoft.com/Mail.ReadWrite',
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/User.Read',
        ],
        account: null, // Will need to get account from cache
      };

      // For now, throw error to indicate re-auth needed
      throw new Error('Token refresh requires re-authentication');
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

  // Get user profile information
  async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Set up webhook subscription for email monitoring
  async createWebhookSubscription(accessToken: string, notificationUrl: string): Promise<string> {
    try {
      const subscription = {
        changeType: 'created',
        notificationUrl: notificationUrl,
        resource: 'me/messages',
        expirationDateTime: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(), // 24 hours
        clientState: 'email-drafts-agent', // For security validation
      };

      const response = await axios.post(`${this.baseUrl}/subscriptions`, subscription, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating webhook subscription:', error);
      throw error;
    }
  }

  // Renew webhook subscription
  async renewWebhookSubscription(accessToken: string, subscriptionId: string): Promise<void> {
    try {
      const subscription = {
        expirationDateTime: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
      };

      await axios.patch(`${this.baseUrl}/subscriptions/${subscriptionId}`, subscription, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error renewing webhook subscription:', error);
      throw error;
    }
  }

  // Delete webhook subscription
  async deleteWebhookSubscription(accessToken: string, subscriptionId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/subscriptions/${subscriptionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      console.error('Error deleting webhook subscription:', error);
      throw error;
    }
  }

  // Get email details by ID
  async getEmailById(accessToken: string, emailId: string): Promise<EmailData> {
    try {
      const response = await axios.get(`${this.baseUrl}/me/messages/${emailId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const message = response.data;

      return {
        id: message.id,
        subject: message.subject || '',
        body: message.body?.content || '',
        sender: {
          name: message.sender?.emailAddress?.name || '',
          email: message.sender?.emailAddress?.address || '',
        },
        recipients: message.toRecipients?.map((recipient: any) => ({
          name: recipient.emailAddress?.name || '',
          email: recipient.emailAddress?.address || '',
        })) || [],
        receivedDateTime: message.receivedDateTime || '',
        conversationId: message.conversationId || '',
      };
    } catch (error) {
      console.error('Error getting email by ID:', error);
      throw error;
    }
  }

  // Create draft reply
  async createDraftReply(
    accessToken: string, 
    originalEmailId: string, 
    replyContent: string,
    subject?: string
  ): Promise<DraftResponse> {
    try {
      // Get the original message first
      const originalResponse = await axios.get(`${this.baseUrl}/me/messages/${originalEmailId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const originalMessage = originalResponse.data;

      const draftReply = {
        subject: subject || `Re: ${originalMessage.subject}`,
        body: {
          contentType: 'HTML',
          content: replyContent,
        },
        toRecipients: [
          {
            emailAddress: {
              address: originalMessage.sender?.emailAddress?.address,
              name: originalMessage.sender?.emailAddress?.name,
            },
          },
        ],
      };

      // Create draft in drafts folder
      const response = await axios.post(`${this.baseUrl}/me/messages`, draftReply, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      return {
        id: response.data.id || '',
        subject: response.data.subject || '',
        body: response.data.body?.content || '',
      };
    } catch (error) {
      console.error('Error creating draft reply:', error);
      throw error;
    }
  }

  // Send draft (if user approves)
  async sendDraft(accessToken: string, draftId: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/me/messages/${draftId}/send`, {}, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error sending draft:', error);
      throw error;
    }
  }

  // Update draft content
  async updateDraft(
    accessToken: string, 
    draftId: string, 
    updatedContent: string
  ): Promise<void> {
    try {
      const updatedDraft = {
        body: {
          contentType: 'HTML',
          content: updatedContent,
        },
      };

      await axios.patch(`${this.baseUrl}/me/messages/${draftId}`, updatedDraft, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error updating draft:', error);
      throw error;
    }
  }

  // Get recent emails (for testing)
  async getRecentEmails(accessToken: string, count: number = 10): Promise<EmailData[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/me/messages?$top=${count}&$orderby=receivedDateTime desc`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const messages = response.data.value || [];

      return messages.map((message: any) => ({
        id: message.id,
        subject: message.subject || '',
        body: message.body?.content || '',
        sender: {
          name: message.sender?.emailAddress?.name || '',
          email: message.sender?.emailAddress?.address || '',
        },
        recipients: message.toRecipients?.map((recipient: any) => ({
          name: recipient.emailAddress?.name || '',
          email: recipient.emailAddress?.address || '',
        })) || [],
        receivedDateTime: message.receivedDateTime || '',
        conversationId: message.conversationId || '',
      }));
    } catch (error) {
      console.error('Error getting recent emails:', error);
      throw error;
    }
  }

  // Validate webhook notification (security)
  validateWebhookNotification(clientState: string): boolean {
    return clientState === 'email-drafts-agent';
  }
}

export const microsoftGraphService = new MicrosoftGraphService();