import React, { useState, useEffect } from 'react';
import { Plus, ExternalLink, CheckCircle, XCircle, RefreshCw, Trash2, Settings, ToggleLeft, ToggleRight } from 'lucide-react';
import { clientAPI, authAPI, Client } from '../services/api';

interface ClientManagerProps {
  selectedClientId: string;
  onClientSelect: (clientId: string) => void;
}

interface AISettings {
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
}

export default function ClientManager({ selectedClientId, onClientSelect }: ClientManagerProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showSettingsFor, setShowSettingsFor] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<{[key: string]: any}>({});

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    companyName: '',
    tenantId: 'common'
  });

  const [aiSettings, setAiSettings] = useState<AISettings>({
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
  });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const storedClients = localStorage.getItem('demo_clients');
      const clientIds = storedClients ? JSON.parse(storedClients) : [];
      
      if (clientIds.length > 0) {
        const clientData = await Promise.all(
          clientIds.map(async (id: string) => {
            try {
              const response = await clientAPI.getProfile(id);
              return response.client;
            } catch (error) {
              console.error(`Failed to load client ${id}:`, error);
              return null;
            }
          })
        );
        setClients(clientData.filter(Boolean));
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAIEnabled = async (clientId: string, enabled: boolean) => {
    try {
      await clientAPI.updateProfile(clientId, { 
        businessContext: { aiEnabled: enabled }
      });
      
      setClients(clients.map(client => 
        client.id === clientId 
          ? { ...client, businessContext: { ...client.businessContext, aiEnabled: enabled } }
          : client
      ));
    } catch (error: any) {
      console.error('Failed to toggle AI:', error);
      alert('Failed to update AI settings');
    }
  };

  const updateAISettings = async (clientId: string, settings: AISettings) => {
    try {
      await clientAPI.updateProfile(clientId, {
        businessContext: { aiSettings: settings }
      });
      
      setClients(clients.map(client => 
        client.id === clientId 
          ? { ...client, businessContext: { ...client.businessContext, aiSettings: settings } }
          : client
      ));
      
      setShowSettingsFor('');
    } catch (error: any) {
      console.error('Failed to update AI settings:', error);
      alert('Failed to update AI settings');
    }
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await clientAPI.register({
        ...formData,
        businessContext: { 
          aiEnabled: true,
          aiSettings: {
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
          }
        }
      });
      
      const newClient = response.client;
      
      const storedClients = localStorage.getItem('demo_clients');
      const clientIds = storedClients ? JSON.parse(storedClients) : [];
      clientIds.push(newClient.id);
      localStorage.setItem('demo_clients', JSON.stringify(clientIds));
      
      setClients([...clients, newClient]);
      setFormData({ email: '', name: '', companyName: '', tenantId: 'common' });
      setShowCreateForm(false);
      onClientSelect(newClient.id);
    } catch (error: any) {
      console.error('Failed to create client:', error);
      alert(error.response?.data?.error || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const startOAuthFlow = async (clientId: string) => {
    try {
      const response = await authAPI.getMicrosoftLoginUrl(clientId);
      window.open(response.authUrl, '_blank');
      setTimeout(() => loadAuthStatus(clientId), 2000);
    } catch (error: any) {
      console.error('Failed to start OAuth:', error);
      alert(error.response?.data?.error || 'Failed to start OAuth flow');
    }
  };

  const loadAuthStatus = async (clientId: string) => {
    try {
      const status = await authAPI.getStatus(clientId);
      setAuthStatus(prev => ({ ...prev, [clientId]: status }));
    } catch (error) {
      console.error('Failed to load auth status:', error);
      setAuthStatus(prev => ({ ...prev, [clientId]: { isConnected: false, error: true } }));
    }
  };

  const refreshTokens = async (clientId: string) => {
    try {
      await authAPI.refreshTokens(clientId);
      loadAuthStatus(clientId);
    } catch (error: any) {
      console.error('Failed to refresh tokens:', error);
      alert(error.response?.data?.error || 'Failed to refresh tokens');
    }
  };

  const disconnectClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to disconnect this client from Microsoft 365?')) {
      return;
    }
    
    try {
      await authAPI.disconnect(clientId);
      setAuthStatus(prev => ({ ...prev, [clientId]: { isConnected: false } }));
    } catch (error: any) {
      console.error('Failed to disconnect client:', error);
      alert(error.response?.data?.error || 'Failed to disconnect client');
    }
  };

  const testGraphConnection = async (clientId: string) => {
    try {
      const response = await clientAPI.testGraph(clientId);
      alert(`Graph connection successful! Found ${response.recentEmailsCount} recent emails.`);
    } catch (error: any) {
      console.error('Graph connection failed:', error);
      alert(error.response?.data?.error || 'Graph connection failed');
    }
  };

  useEffect(() => {
    clients.forEach(client => {
      if (client.hasActiveTokens) {
        loadAuthStatus(client.id);
      }
    });
  }, [clients]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
          <p className="text-gray-600">Manage AI email agents for your clients</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </button>
      </div>

      {showCreateForm && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Create New Client</h3>
          <form onSubmit={createClient} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Company Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="label">Tenant ID</label>
                <input
                  type="text"
                  value={formData.tenantId}
                  onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                  className="input-field"
                  placeholder="common (default)"
                />
              </div>
            </div>
            <div className="flex space-x-4">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Client'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {showSettingsFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">AI Response Settings</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Response Style</label>
                  <select
                    value={aiSettings.responseStyle}
                    onChange={(e) => setAiSettings({...aiSettings, responseStyle: e.target.value as any})}
                    className="input-field"
                  >
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="concise">Concise</option>
                  </select>
                </div>
                <div>
                  <label className="label">Response Length</label>
                  <select
                    value={aiSettings.responseLength}
                    onChange={(e) => setAiSettings({...aiSettings, responseLength: e.target.value as any})}
                    className="input-field"
                  >
                    <option value="short">Short (1-2 sentences)</option>
                    <option value="medium">Medium (1 paragraph)</option>
                    <option value="detailed">Detailed (Multiple paragraphs)</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="label">Tone</label>
                <select
                  value={aiSettings.tone}
                  onChange={(e) => setAiSettings({...aiSettings, tone: e.target.value as any})}
                  className="input-field"
                >
                  <option value="formal">Formal</option>
                  <option value="friendly">Friendly</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={aiSettings.requireApproval}
                    onChange={(e) => setAiSettings({...aiSettings, requireApproval: e.target.checked})}
                    className="mr-2"
                  />
                  Always require approval before sending
                </label>
              </div>
            </div>
            
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => updateAISettings(showSettingsFor, aiSettings)}
                className="btn-primary"
              >
                Save Settings
              </button>
              <button
                onClick={() => setShowSettingsFor('')}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading && clients.length === 0 ? (
          <div className="card text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-500">No clients yet. Create your first client to get started.</p>
          </div>
        ) : (
          clients.map((client) => {
            const status = authStatus[client.id];
            const isSelected = client.id === selectedClientId;
            const aiEnabled = client.businessContext?.aiEnabled ?? true;
            
            return (
              <div
                key={client.id}
                className={`card cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary-500 border-primary-200' : 'hover:shadow-lg'
                }`}
                onClick={() => onClientSelect(client.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{client.name}</h3>
                      {status?.isConnected ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAIEnabled(client.id, !aiEnabled);
                        }}
                        className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                          aiEnabled 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title={`AI is ${aiEnabled ? 'enabled' : 'disabled'}`}
                      >
                        {aiEnabled ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                        <span>AI {aiEnabled ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>
                    <p className="text-gray-600">{client.email}</p>
                    <p className="text-sm text-gray-500">{client.companyName}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Created: {new Date(client.createdAt).toLocaleDateString()}</span>
                      <span>Status: {status?.isConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const settings = client.businessContext?.aiSettings || {
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
                        };
                        setAiSettings(settings);
                        setShowSettingsFor(client.id);
                      }}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-200"
                      title="AI Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>

                    {status?.isConnected ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            testGraphConnection(client.id);
                          }}
                          className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-md hover:bg-green-200"
                          title="Test Graph Connection"
                        >
                          Test
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectClient(client.id);
                          }}
                          className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200"
                          title="Disconnect"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startOAuthFlow(client.id);
                        }}
                        className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200 flex items-center"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Connect Microsoft 365
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}