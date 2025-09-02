import express from 'express';
import { databaseService } from '../services/database';
import { microsoftGraphService } from '../services/microsoftGraph';

const router = express.Router();

// Create a new client
router.post('/register', async (req, res): Promise<void> => {
  try {
    const { email, name, companyName, tenantId, businessContext } = req.body;

    if (!email || !name || !companyName) {
      res.status(400).json({ 
        error: 'Missing required fields: email, name, companyName' 
      });
      return;
    }

    // Check if client already exists
    const existingClient = await databaseService.getClientByEmail(email);
    if (existingClient) {
      res.status(409).json({ error: 'Client with this email already exists' });
      return;
    }

    // Create new client
    const client = await databaseService.createClient({
      email,
      name,
      companyName,
      tenantId: tenantId || 'common',
      businessContext: businessContext || {},
    });

    res.status(201).json({
      message: 'Client registered successfully',
      client: {
        id: client.id,
        email: client.email,
        name: client.name,
        companyName: client.companyName,
        isActive: client.isActive,
      },
      nextStep: `Use /api/auth/microsoft/login/${client.id} to connect Microsoft 365`,
    });

  } catch (error) {
    console.error('Error registering client:', error);
    res.status(500).json({ error: 'Failed to register client' });
  }
});

// Get client profile
router.get('/profile/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    
    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Don't return sensitive data
    const clientProfile = {
      id: client.id,
      email: client.email,
      name: client.name,
      companyName: client.companyName,
      tenantId: client.tenantId,
      businessContext: client.businessContext,
      isActive: client.isActive,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      hasActiveTokens: !!(client.accessToken && client.refreshToken),
      tokenExpiry: client.tokenExpiry,
    };

    res.json({
      client: clientProfile,
      responseTemplates: client.responseTemplates,
    });

  } catch (error) {
    console.error('Error getting client profile:', error);
    res.status(500).json({ error: 'Failed to get client profile' });
  }
});

// Update client profile
router.put('/profile/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    const { name, companyName, businessContext } = req.body;

    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Update client data
    const updatedClient = await databaseService.getPrisma().client.update({
      where: { id: clientId },
      data: {
        name: name || client.name,
        companyName: companyName || client.companyName,
        businessContext: businessContext !== undefined ? businessContext : client.businessContext,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Client profile updated successfully',
      client: {
        id: updatedClient.id,
        email: updatedClient.email,
        name: updatedClient.name,
        companyName: updatedClient.companyName,
        businessContext: updatedClient.businessContext,
        updatedAt: updatedClient.updatedAt,
      },
    });

  } catch (error) {
    console.error('Error updating client profile:', error);
    res.status(500).json({ error: 'Failed to update client profile' });
  }
});

// Get client emails
router.get('/emails/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    const { limit = '10', offset = '0', status } = req.query;

    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const emails = await databaseService.getPrisma().email.findMany({
      where: { 
        clientId,
        ...(status && { status: status as any }),
      },
      include: {
        aiResponses: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const totalCount = await databaseService.getPrisma().email.count({
      where: { 
        clientId,
        ...(status && { status: status as any }),
      },
    });

    res.json({
      emails,
      pagination: {
        total: totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: totalCount > parseInt(offset as string) + parseInt(limit as string),
      },
    });

  } catch (error) {
    console.error('Error getting client emails:', error);
    res.status(500).json({ error: 'Failed to get client emails' });
  }
});

// Create response template
router.post('/templates/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    const { name, category, trigger, template } = req.body;

    if (!name || !category || !trigger || !template) {
      res.status(400).json({ 
        error: 'Missing required fields: name, category, trigger, template' 
      });
      return;
    }

    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const responseTemplate = await databaseService.createResponseTemplate({
      clientId,
      name,
      category,
      trigger,
      template,
    });

    res.status(201).json({
      message: 'Response template created successfully',
      template: responseTemplate,
    });

  } catch (error) {
    console.error('Error creating response template:', error);
    res.status(500).json({ error: 'Failed to create response template' });
  }
});

// Get response templates
router.get('/templates/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;
    const { category } = req.query;

    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    let templates;
    if (category) {
      templates = await databaseService.getPrisma().responseTemplate.findMany({
        where: { 
          clientId,
          category: category as string,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      templates = await databaseService.getResponseTemplates(clientId);
    }

    res.json({
      templates,
      categories: await getTemplateCategories(clientId),
    });

  } catch (error) {
    console.error('Error getting response templates:', error);
    res.status(500).json({ error: 'Failed to get response templates' });
  }
});

// Update response template
router.put('/templates/:clientId/:templateId', async (req, res): Promise<void> => {
  try {
    const { clientId, templateId } = req.params;
    const { name, category, trigger, template, isActive } = req.body;

    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const updatedTemplate = await databaseService.getPrisma().responseTemplate.update({
      where: { 
        id: templateId,
        clientId, // Ensure template belongs to client
      },
      data: {
        name: name || undefined,
        category: category || undefined,
        trigger: trigger || undefined,
        template: template || undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date(),
      },
    });

    res.json({
      message: 'Response template updated successfully',
      template: updatedTemplate,
    });

  } catch (error) {
    console.error('Error updating response template:', error);
    res.status(500).json({ error: 'Failed to update response template' });
  }
});

// Delete response template
router.delete('/templates/:clientId/:templateId', async (req, res): Promise<void> => {
  try {
    const { clientId, templateId } = req.params;

    const client = await databaseService.getClientById(clientId);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Soft delete by setting isActive to false
    await databaseService.getPrisma().responseTemplate.update({
      where: { 
        id: templateId,
        clientId,
      },
      data: { isActive: false },
    });

    res.json({
      message: 'Response template deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting response template:', error);
    res.status(500).json({ error: 'Failed to delete response template' });
  }
});

// Test Microsoft Graph connection
router.get('/test-graph/:clientId', async (req, res): Promise<void> => {
  try {
    const { clientId } = req.params;

    const client = await databaseService.getClientById(clientId);
    if (!client || !client.accessToken) {
      res.status(404).json({ error: 'Client not found or not connected to Microsoft 365' });
      return;
    }

    // Get recent emails to test connection
    const recentEmails = await microsoftGraphService.getRecentEmails(client.accessToken, 5);

    res.json({
      message: 'Microsoft Graph connection successful',
      recentEmailsCount: recentEmails.length,
      recentEmails: recentEmails.map(email => ({
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        receivedDateTime: email.receivedDateTime,
      })),
    });

  } catch (error) {
    console.error('Error testing Graph connection:', error);
    
    // If token is expired, suggest refresh
    if (error instanceof Error && error.message.includes('token')) {
      res.status(401).json({ 
        error: 'Microsoft 365 token expired',
        suggestion: `Use /api/auth/microsoft/refresh/${req.params.clientId} to refresh tokens`,
      });
      return;
    }

    res.status(500).json({ error: 'Failed to connect to Microsoft Graph' });
  }
});

// Helper function to get template categories
async function getTemplateCategories(clientId: string): Promise<string[]> {
  const categories = await databaseService.getPrisma().responseTemplate.findMany({
    where: { clientId, isActive: true },
    select: { category: true },
    distinct: ['category'],
  });

  return categories.map(c => c.category);
}

export default router;