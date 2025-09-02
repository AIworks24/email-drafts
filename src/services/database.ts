import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

class DatabaseService {
  private prisma: PrismaClient;
  private encryptionKey: Buffer;

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    });
    
    // Initialize encryption key
    this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef', 'hex');
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      console.log('✅ Database connection successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  // Client operations
  async createClient(data: {
    email: string;
    name: string;
    companyName: string;
    tenantId: string;
    accessToken?: string;
    refreshToken?: string;
    businessContext?: any;
  }) {
    try {
      return await this.prisma.client.create({
        data: {
          ...data,
          accessToken: data.accessToken ? this.encrypt(data.accessToken) : null,
          refreshToken: data.refreshToken ? this.encrypt(data.refreshToken) : null,
        },
      });
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  }

  async getClientByEmail(email: string) {
    try {
      const client = await this.prisma.client.findUnique({
        where: { email },
        include: {
          responseTemplates: {
            where: { isActive: true }
          },
        },
      });

      if (client && client.accessToken) {
        client.accessToken = this.decrypt(client.accessToken);
      }
      if (client && client.refreshToken) {
        client.refreshToken = this.decrypt(client.refreshToken);
      }

      return client;
    } catch (error) {
      console.error('Error getting client by email:', error);
      throw error;
    }
  }

  async getClientById(id: string) {
    try {
      const client = await this.prisma.client.findUnique({
        where: { id },
        include: {
          responseTemplates: {
            where: { isActive: true }
          },
        },
      });

      if (client && client.accessToken) {
        client.accessToken = this.decrypt(client.accessToken);
      }
      if (client && client.refreshToken) {
        client.refreshToken = this.decrypt(client.refreshToken);
      }

      return client;
    } catch (error) {
      console.error('Error getting client by ID:', error);
      throw error;
    }
  }

  async updateClientTokens(clientId: string, accessToken: string, refreshToken: string, expiresAt: Date) {
    try {
      return await this.prisma.client.update({
        where: { id: clientId },
        data: {
          accessToken: this.encrypt(accessToken),
          refreshToken: this.encrypt(refreshToken),
          tokenExpiry: expiresAt,
        },
      });
    } catch (error) {
      console.error('Error updating client tokens:', error);
      throw error;
    }
  }

  // Email operations
  async saveEmail(data: {
    microsoftId: string;
    clientId: string;
    subject: string;
    body: string;
    sender: string;
    senderEmail: string;
    recipients: any[];
    threadId?: string;
    receivedAt: Date;
  }) {
    try {
      return await this.prisma.email.create({
        data: {
          ...data,
          recipients: data.recipients,
        },
      });
    } catch (error) {
      console.error('Error saving email:', error);
      throw error;
    }
  }

  async getEmailById(emailId: string) {
    try {
      return await this.prisma.email.findUnique({
        where: { id: emailId },
        include: {
          client: true,
          aiResponses: true,
        },
      });
    } catch (error) {
      console.error('Error getting email by ID:', error);
      throw error;
    }
  }

  async updateEmailStatus(emailId: string, status: any) {
    try {
      return await this.prisma.email.update({
        where: { id: emailId },
        data: { 
          status,
          processedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error updating email status:', error);
      throw error;
    }
  }

  // AI Response operations
  async saveAIResponse(data: {
    emailId: string;
    responseContent: string;
    confidence?: number;
    templateUsed?: string;
    draftId?: string;
  }) {
    try {
      return await this.prisma.aIResponse.create({
        data,
      });
    } catch (error) {
      console.error('Error saving AI response:', error);
      throw error;
    }
  }

  async updateAIResponseStatus(responseId: string, status: any, draftId?: string) {
    try {
      const updateData: any = { 
        status,
      };
      
      if (draftId !== undefined) {
        updateData.draftId = draftId;
      }

      return await this.prisma.aIResponse.update({
        where: { id: responseId },
        data: updateData,
      });
    } catch (error) {
      console.error('Error updating AI response status:', error);
      throw error;
    }
  }

  // Template operations
  async getResponseTemplates(clientId: string) {
    try {
      return await this.prisma.responseTemplate.findMany({
        where: { 
          clientId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    } catch (error) {
      console.error('Error getting response templates:', error);
      throw error;
    }
  }

  async createResponseTemplate(data: {
    clientId: string;
    name: string;
    category: string;
    trigger: string;
    template: string;
  }) {
    try {
      return await this.prisma.responseTemplate.create({
        data,
      });
    } catch (error) {
      console.error('Error creating response template:', error);
      throw error;
    }
  }

  // Webhook subscriptions
  async saveWebhookSubscription(data: {
    clientId: string;
    subscriptionId: string;
    resource: string;
    expirationTime: Date;
  }) {
    try {
      return await this.prisma.webhookSubscription.create({
        data,
      });
    } catch (error) {
      console.error('Error saving webhook subscription:', error);
      throw error;
    }
  }

  async getActiveWebhookSubscriptions() {
    try {
      return await this.prisma.webhookSubscription.findMany({
        where: { isActive: true },
      });
    } catch (error) {
      console.error('Error getting active webhook subscriptions:', error);
      throw error;
    }
  }

  async deactivateWebhookSubscription(subscriptionId: string) {
    try {
      return await this.prisma.webhookSubscription.update({
        where: { subscriptionId },
        data: { isActive: false },
      });
    } catch (error) {
      console.error('Error deactivating webhook subscription:', error);
      throw error;
    }
  }

  // Utility methods for encryption/decryption
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted text parts');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8') as string;
    decrypted += decipher.final('utf8') as string;
    
    return decrypted;
  }

  // Cleanup
  async disconnect() {
    await this.prisma.$disconnect();
  }

  // Get Prisma instance for complex queries
  getPrisma() {
    return this.prisma;
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;