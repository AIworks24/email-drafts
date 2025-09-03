import Anthropic from '@anthropic-ai/sdk';

interface ClientWorkspace {
  clientId: string;
  businessContext: any;
  aiSettings: {
    responseStyle: 'professional' | 'casual' | 'concise';
    responseLength: 'short' | 'medium' | 'detailed';
    tone: 'formal' | 'friendly' | 'neutral';
    autoRespond: boolean;
    requireApproval: boolean;
    businessHours: {
      enabled: boolean;
      start: string;
      end: string;
      timezone: string;
    };
  };
  templates: Array<{
    name: string;
    category: string;
    trigger: string;
    template: string;
  }>;
}

interface EmailContext {
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
  threadId?: string;
  receivedAt: string;
}

interface AIResponse {
  content: string;
  confidence: number;
  templateUsed?: string;
  reasoning: string;
}

class ClaudeAIService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
    });
  }

  async generateEmailResponse(
    workspace: ClientWorkspace, 
    emailContext: EmailContext,
    conversationHistory?: string
  ): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(workspace);
      const userPrompt = this.buildUserPrompt(workspace, emailContext, conversationHistory);

      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: this.getMaxTokens(workspace.aiSettings.responseLength),
        temperature: this.getTemperature(workspace.aiSettings.responseStyle),
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      // Handle the response content safely
      if (response.content && response.content.length > 0) {
        const responseContent = response.content[0];
        if (responseContent && responseContent.type === 'text') {
          return this.parseAIResponse((responseContent as any).text, workspace);
        }
      }
      
      throw new Error('No valid response content from Claude');

    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private buildSystemPrompt(workspace: ClientWorkspace): string {
    const { aiSettings, businessContext } = workspace;
    
    let systemPrompt = `You are an AI email assistant for ${businessContext?.companyName || 'a business professional'}. Your role is to help generate appropriate email responses based on the provided context and settings.

RESPONSE GUIDELINES:
- Style: ${aiSettings.responseStyle} (${this.getStyleGuidance(aiSettings.responseStyle)})
- Length: ${aiSettings.responseLength} (${this.getLengthGuidance(aiSettings.responseLength)})
- Tone: ${aiSettings.tone} (${this.getToneGuidance(aiSettings.tone)})

BUSINESS CONTEXT:`;

    if (businessContext?.companyName) {
      systemPrompt += `\n- Company: ${businessContext.companyName}`;
    }
    
    if (businessContext?.industry) {
      systemPrompt += `\n- Industry: ${businessContext.industry}`;
    }
    
    if (businessContext?.services) {
      systemPrompt += `\n- Services: ${businessContext.services}`;
    }
    
    if (businessContext?.policies) {
      systemPrompt += `\n- Policies: ${businessContext.policies}`;
    }

    systemPrompt += `

RESPONSE FORMAT:
Please respond with a JSON object in this exact format:
{
  "emailResponse": "Your complete email response here",
  "confidence": 0.85,
  "templateUsed": "template_name_or_null",
  "reasoning": "Brief explanation of why this response was chosen"
}

IMPORTANT:
- Always maintain the specified tone and style
- Keep responses ${aiSettings.responseLength === 'short' ? 'brief and to the point' : aiSettings.responseLength === 'medium' ? 'moderately detailed' : 'comprehensive and thorough'}
- Include a proper email greeting and closing
- Never make commitments the business cannot keep
- If unsure about specific details, ask for clarification rather than guessing`;

    return systemPrompt;
  }

  private buildUserPrompt(
    workspace: ClientWorkspace, 
    emailContext: EmailContext,
    conversationHistory?: string
  ): string {
    let userPrompt = `Please generate an appropriate email response for the following incoming email:

FROM: ${emailContext.sender.name} (${emailContext.sender.email})
SUBJECT: ${emailContext.subject}
RECEIVED: ${new Date(emailContext.receivedAt).toLocaleString()}

EMAIL CONTENT:
${emailContext.body}`;

    if (conversationHistory) {
      userPrompt += `\n\nCONVERSATION HISTORY:\n${conversationHistory}`;
    }

    const relevantTemplates = this.findRelevantTemplates(workspace.templates, emailContext);
    if (relevantTemplates.length > 0) {
      userPrompt += `\n\nRELEVANT TEMPLATES:`;
      relevantTemplates.forEach((template, index) => {
        userPrompt += `\n\nTemplate ${index + 1} (${template.name}):\n${template.template}`;
      });
      userPrompt += `\n\nYou may use these templates as inspiration, but adapt them to the specific context of this email.`;
    }

    if (workspace.aiSettings.businessHours.enabled) {
      const now = new Date();
      const isBusinessHours = this.isWithinBusinessHours(now, workspace.aiSettings.businessHours);
      if (!isBusinessHours) {
        userPrompt += `\n\nNOTE: This email was received outside business hours. Consider mentioning response times or business hours if appropriate.`;
      }
    }

    return userPrompt;
  }

  private parseAIResponse(responseText: string, workspace: ClientWorkspace): AIResponse {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          content: responseText.trim(),
          confidence: 0.7,
          reasoning: 'Response parsed without structured format'
        };
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      return {
        content: parsedResponse.emailResponse || responseText.trim(),
        confidence: parsedResponse.confidence || 0.7,
        templateUsed: parsedResponse.templateUsed || undefined,
        reasoning: parsedResponse.reasoning || 'AI-generated response'
      };
    } catch (error) {
      console.warn('Failed to parse structured AI response, using fallback');
      return {
        content: responseText.trim(),
        confidence: 0.6,
        reasoning: 'Response parsing failed, using raw content'
      };
    }
  }

  private findRelevantTemplates(templates: any[], emailContext: EmailContext): any[] {
    if (!templates || templates.length === 0) return [];

    const emailText = `${emailContext.subject} ${emailContext.body}`.toLowerCase();
    
    return templates.filter(template => {
      if (!template.trigger) return false;
      
      const triggers = template.trigger.toLowerCase().split(',').map((t: string) => t.trim());
      return triggers.some((trigger: string) => emailText.includes(trigger));
    }).slice(0, 3);
  }

  private isWithinBusinessHours(date: Date, businessHours: any): boolean {
    try {
      if (!businessHours || !businessHours.start || !businessHours.end) {
        return true;
      }
      
      const hour = date.getHours();
      const startHour = parseInt(businessHours.start.split(':')[0]);
      const endHour = parseInt(businessHours.end.split(':')[0]);
      
      return hour >= startHour && hour < endHour;
    } catch (error) {
      return true;
    }
  }

  private getMaxTokens(length: string): number {
    switch (length) {
      case 'short': return 150;
      case 'medium': return 300;
      case 'detailed': return 600;
      default: return 300;
    }
  }

  private getTemperature(style: string): number {
    switch (style) {
      case 'professional': return 0.3;
      case 'casual': return 0.7;
      case 'concise': return 0.2;
      default: return 0.5;
    }
  }

  private getStyleGuidance(style: string): string {
    switch (style) {
      case 'professional': return 'formal business language, structured responses';
      case 'casual': return 'conversational, approachable tone';
      case 'concise': return 'direct, brief, essential information only';
      default: return 'balanced professional approach';
    }
  }

  private getLengthGuidance(length: string): string {
    switch (length) {
      case 'short': return '1-2 sentences plus greeting/closing';
      case 'medium': return '1-2 paragraphs with complete thoughts';
      case 'detailed': return 'comprehensive response with multiple paragraphs';
      default: return 'appropriately detailed for the context';
    }
  }

  private getToneGuidance(tone: string): string {
    switch (tone) {
      case 'formal': return 'respectful, traditional business communication';
      case 'friendly': return 'warm, personable, building relationships';
      case 'neutral': return 'balanced, neither too formal nor too casual';
      default: return 'appropriate for business context';
    }
  }

  async validateResponse(response: string, workspace: ClientWorkspace): Promise<boolean> {
    return true;
  }

  async recordUserEdit(
    originalResponse: string, 
    editedResponse: string, 
    workspace: ClientWorkspace
  ): Promise<void> {
    console.log('User edit recorded for workspace:', workspace.clientId);
  }
}

export const claudeAIService = new ClaudeAIService();