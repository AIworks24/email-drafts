import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000, 
  withCredentials: false, // Set to false for CORS in production
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.response?.data);
    return Promise.reject(error);
  }
);

// Types
export interface Client {
  id: string;
  email: string;
  name: string;
  companyName: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasActiveTokens: boolean;
  tokenExpiry: string | null;
}

export interface Email {
  id: string;
  subject: string;
  sender: string;
  senderEmail: string;
  receivedAt: string;
  status: string;
  aiResponses: AIResponse[];
}

export interface AIResponse {
  id: string;
  responseContent: string;
  confidence: number | null;
  templateUsed: string | null;
  status: string;
  createdAt: string;
  draftId: string | null;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  trigger: string;
  template: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Client Management
export const clientAPI = {
  // Register new client
  async register(data: {
    email: string;
    name: string;
    companyName: string;
    tenantId?: string;
    businessContext?: any;
  }) {
    const response = await api.post('/client/register', data);
    return response.data;
  },

  // Get client profile
  async getProfile(clientId: string) {
    const response = await api.get(`/client/profile/${clientId}`);
    return response.data;
  },

  // Update client profile
  async updateProfile(clientId: string, data: {
    name?: string;
    companyName?: string;
    businessContext?: any;
  }) {
    const response = await api.put(`/client/profile/${clientId}`, data);
    return response.data;
  },

  // Get client emails
  async getEmails(clientId: string, params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }) {
    const response = await api.get(`/client/emails/${clientId}`, { params });
    return response.data;
  },

  // Test Graph connection
  async testGraph(clientId: string) {
    const response = await api.get(`/client/test-graph/${clientId}`);
    return response.data;
  },
};

// Authentication
export const authAPI = {
  // Get Microsoft login URL
  async getMicrosoftLoginUrl(clientId: string) {
    const response = await api.get(`/auth/microsoft/login/${clientId}`);
    return response.data;
  },

  // Get auth status
  async getStatus(clientId: string) {
    const response = await api.get(`/auth/status/${clientId}`);
    return response.data;
  },

  // Refresh tokens
  async refreshTokens(clientId: string) {
    const response = await api.post(`/auth/microsoft/refresh/${clientId}`);
    return response.data;
  },

  // Disconnect
  async disconnect(clientId: string) {
    const response = await api.post(`/auth/microsoft/disconnect/${clientId}`);
    return response.data;
  },
};

// Template Management
export const templateAPI = {
  // Get templates
  async getTemplates(clientId: string, category?: string) {
    const params = category ? { category } : undefined;
    const response = await api.get(`/client/templates/${clientId}`, { params });
    return response.data;
  },

  // Create template
  async createTemplate(clientId: string, data: {
    name: string;
    category: string;
    trigger: string;
    template: string;
  }) {
    const response = await api.post(`/client/templates/${clientId}`, data);
    return response.data;
  },

  // Update template
  async updateTemplate(clientId: string, templateId: string, data: {
    name?: string;
    category?: string;
    trigger?: string;
    template?: string;
  }) {
    const response = await api.put(`/client/templates/${clientId}/${templateId}`, data);
    return response.data;
  },

  // Delete template
  async deleteTemplate(clientId: string, templateId: string) {
    const response = await api.delete(`/client/templates/${clientId}/${templateId}`);
    return response.data;
  },
};
