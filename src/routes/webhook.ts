import express from 'express';
import { microsoftGraphService } from '../services/microsoftGraph';
import { databaseService } from '../services/database';
import { claudeAIService } from '../services/claudeAI';

const router = express.Router();

// Microsoft webhook validation endpoint
router.get('/microsoft/:clientId', (req, res): void => {
  // Microsoft Graph sends a validation request
  const validationToken = req.query.validationToken;
  
  if (validationToken) {
    console.log('Webhook validation request received for client:', req.params.clientId);
    // Return the validation token as plain text
    res.status(200).type('text/plain').send(validationToken);
    return;
  }
  
  res.status(400).json({ error: 'Missing validation token' });
});

// Microsoft webhook notification endpoint
router.post('/microsoft/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const notifications = req.body.value || [];

    console.log(`📧 Received ${notifications.length} notifications for client:`, clientId);

    // Acknowledge receipt immediately
    res.status(202).json({ message: 'Notifications received' });

    // Process notifications asynchronously
    processNotificationsAsync(clientId, notifications);

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Process notifications asynchronously
async function processNotificationsAsync(clientId: string, notifications: any[]) {
  try {
    const client = await databaseService.getClientById(clientId);
    if (!client || !client.accessToken) {
      console.error('Client not found or no access token:', clientId);
      return;
    }

    for (const notification of notifications) {
      try {
        // Validate the notification
        if (!microsoftGraphService.validateWebhookNotification(notification.clientState)) {
          console.error('Invalid webhook notification client state');
          continue;
        }

        // Only process new email notifications
        if (notification.changeType === 'created' && notification.resourceData) {
          await processNewEmail(clientId, client.accessToken, notification.resourceData);
        }

      } catch (error) {
        console.error('Error processing individual notification:', error);
      }
    }

  } catch (error) {
    console.error('Error in processNotificationsAsync:', error);
  }
}

// Process a new email
async function processNewEmail(clientId: string, accessToken: string, resourceData: any) {
  try {
    console.log('📨 Processing new email for client:', clientId);

    // Get client workspace settings
    const client = await databaseService.getClientById(clientId);
    if (!client || !client.aiEnabled) {
      console.log('🚫 AI disabled for client:', clientId);
      return;
    }

    // Get email details from Microsoft Graph
    const emailData = await microsoftGraphService.getEmailById(accessToken, resourceData.id);
    
    // Skip if email is from the client themselves
    if (emailData.sender.email === client.email) {
      console.log('🚫 Skipping auto-response for own email');
      return;
    }

    // Save email to database
    const savedEmail = await databaseService.saveEmail({
      microsoftId: emailData.id,
      clientId: clientId,
      subject: emailData.subject,
      body: emailData.body,
      sender: emailData.sender.name,
      senderEmail: emailData.sender.email,
      recipients: emailData.recipients,
      threadId: emailData.conversationId,
      receivedAt: new Date(emailData.receivedDateTime),
    });

    console.log('💾 Email saved to database:', savedEmail.id);

    // Update email status to processing
    await databaseService.updateEmailStatus(savedEmail.id, 'PROCESSING');

    // Generate AI response using Claude
    await generateAIResponse(client, savedEmail, emailData, accessToken);

  } catch (error) {
    console.error('Error processing new email:', error);
  }
}

// Generate AI response using Claude
async function generateAIResponse(
  client: any, 
  savedEmail: any, 
  emailData: any, 
  accessToken: string
) {
  try {
    // Build workspace from client data
    const workspace = {
      clientId: client.id,
      businessContext: client.businessContext || {},
      aiSettings: client.aiSettings || {
        responseStyle: 'professional',
        responseLength: 'short',
        tone: 'friendly',
        autoRespond: false,
        requireApproval: true,
        businessHours: {
          enabled: false,
          start: '09:00',
          end: '17:00',
          timezone: 'America/New_York'
        }
      },
      templates: await databaseService.getResponseTemplates(client.id)
    };

    // Build email context
    const emailContext = {
      subject: emailData.subject,
      body: emailData.body,
      sender: emailData.sender,
      recipients: emailData.recipients,
      threadId: emailData.conversationId,
      receivedAt: emailData.receivedDateTime
    };

    // Check business hours if enabled
    if (workspace.aiSettings.businessHours.enabled) {
      const now = new Date();
      const isBusinessHours = isWithinBusinessHours(now, workspace.aiSettings.businessHours);
      if (!isBusinessHours) {
        console.log('🕒 Outside business hours, skipping AI response');
        await databaseService.updateEmailStatus(savedEmail.id, 'RECEIVED');
        return;
      }
    }

    console.log('🤖 Generating AI response with Claude...');

    // Generate response using Claude AI
    const aiResponse = await claudeAIService.generateEmailResponse(workspace, emailContext);

    // Create draft reply in Outlook
    const draft = await microsoftGraphService.createDraftReply(
      accessToken,
      emailData.id,
      aiResponse.content,
      `Re: ${emailData.subject}`
    );

    // Save AI response to database
    const aiResponseData: {
      emailId: string;
      responseContent: string;
      confidence?: number;
      templateUsed?: string;
      draftId?: string;
    } = {
      emailId: savedEmail.id,
      responseContent: aiResponse.content,
      confidence: aiResponse.confidence,
      draftId: draft.id,
    };

    // Only add templateUsed if it's defined
    if (aiResponse.templateUsed) {
      aiResponseData.templateUsed = aiResponse.templateUsed;
    }

    const savedAIResponse = await databaseService.saveAIResponse(aiResponseData);

    // Update email status
    await databaseService.updateEmailStatus(savedEmail.id, 'DRAFT_CREATED');

    console.log('✅ AI response generated and draft created:', draft.id);
    console.log('📋 AI response saved:', savedAIResponse.id);
    console.log('🎯 Confidence:', aiResponse.confidence);
    console.log('💭 Reasoning:', aiResponse.reasoning);

    // Update usage stats
    await updateUsageStats(client.id, 'email_processed', 'response_generated');

  } catch (error) {
    console.error('Error generating AI response:', error);
    
    // Update email status to error
    try {
      await databaseService.updateEmailStatus(savedEmail.id, 'ERROR');
    } catch (updateError) {
      console.error('Error updating email status to ERROR:', updateError);
    }
  }
}

    // Helper function to check business hours
    function isWithinBusinessHours(
      date: Date, 
      businessHours: any
    ): boolean {
      try {
        // Default to allowing if business hours aren't configured
        if (!businessHours || !businessHours.start || !businessHours.end) {
          return true;
        }
        
        const hour = date.getHours();
        const startHour = parseInt(businessHours.start.split(':')[0]);
        const endHour = parseInt(businessHours.end.split(':')[0]);
        
        return hour >= startHour && hour < endHour;
      } catch (error) {
        console.error('Error checking business hours:', error);
        return true; // Default to allowing if there's an error
      }
    }

// Helper function to update usage statistics
async function updateUsageStats(clientId: string, ...events: string[]) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // In a real implementation, you'd update the UsageStats table
    // For now, just log the events
    console.log(`📊 Usage stats for ${clientId} on ${today}:`, events);
  } catch (error) {
    console.error('Error updating usage stats:', error);
  }
}

// Temporary simple auto-response (we'll replace this with AI)
async function createSimpleAutoResponse(
  clientId: string, 
  accessToken: string, 
  emailId: string, 
  emailData: any
) {
  try {
    // Skip if email is from the client themselves
    const client = await databaseService.getClientById(clientId);
    if (emailData.sender.email === client?.email) {
      console.log('🚫 Skipping auto-response for own email');
      return;
    }

    // Create a simple acknowledgment response
    const responseContent = `
      <p>Thank you for your email regarding: <strong>${emailData.subject}</strong></p>
      <p>I have received your message and will respond shortly.</p>
      <p>This is an automated response from my AI email assistant.</p>
      <br>
      <p>Best regards</p>
    `;

    // Create draft reply in Outlook
    const draft = await microsoftGraphService.createDraftReply(
      accessToken,
      emailData.id,
      responseContent
    );

    // Save AI response to database
    const aiResponse = await databaseService.saveAIResponse({
      emailId: emailId,
      responseContent: responseContent,
      confidence: 0.8,
      templateUsed: 'simple_acknowledgment',
      draftId: draft.id,
    });

    // Update email status
    await databaseService.updateEmailStatus(emailId, 'DRAFT_CREATED');

    console.log('✅ Draft response created:', draft.id);
    console.log('📋 AI response saved:', aiResponse.id);

  } catch (error) {
    console.error('Error creating auto-response:', error);
    
    // Update email status to error
    try {
      await databaseService.updateEmailStatus(emailId, 'ERROR');
    } catch (updateError) {
      console.error('Error updating email status to ERROR:', updateError);
    }
  }
}

// Webhook subscription renewal endpoint (called by a scheduled job)
router.post('/renew-subscriptions', async (req, res) => {
  try {
    console.log('🔄 Renewing webhook subscriptions...');
    
    const subscriptions = await databaseService.getActiveWebhookSubscriptions();
    let renewedCount = 0;
    let failedCount = 0;

    for (const subscription of subscriptions) {
      try {
        // Check if subscription expires within 6 hours
        const sixHoursFromNow = new Date(Date.now() + (6 * 60 * 60 * 1000));
        
        if (subscription.expirationTime < sixHoursFromNow) {
          const client = await databaseService.getClientById(subscription.clientId);
          
          if (client && client.accessToken) {
            await microsoftGraphService.renewWebhookSubscription(
              client.accessToken,
              subscription.subscriptionId
            );
            renewedCount++;
            console.log(`✅ Renewed subscription for client: ${client.email}`);
          }
        }
      } catch (error) {
        console.error('Error renewing subscription:', error);
        failedCount++;
      }
    }

    res.json({
      message: 'Subscription renewal completed',
      renewed: renewedCount,
      failed: failedCount,
      total: subscriptions.length,
    });

  } catch (error) {
    console.error('Error renewing subscriptions:', error);
    res.status(500).json({ error: 'Failed to renew subscriptions' });
  }
});

export default router;