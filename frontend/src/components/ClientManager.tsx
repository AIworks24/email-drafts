import React, { useState, useEffect } from 'react';
import { Plus, ExternalLink, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { clientAPI, authAPI, Client } from '../services/api';

interface ClientManagerProps {
  selectedClientId: string;
  onClientSelect: (clientId: string) => void;
}

export default function ClientManager({ selectedClientId, onClientSelect }: ClientManagerProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [authStatus, setAuthStatus] = useState<{[key: string]: any}>({});

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    companyName: '',
    tenantId: 'common'
  });

  // Load client data on component mount
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      // For demo purposes, we'll store client IDs in localStorage
      // In production, you'd fetch from your backend
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

  const loadAuthStatus = async (clientId: string) => {
    try {
      const status = await authAPI.getStatus(clientId);
      setAuthStatus(prev => ({ ...prev, [clientId]: status }));
    } catch (error) {
      console.error('Failed to load auth status:', error);
      setAuthStatus(prev => ({ ...prev, [clientId]: { isConnected: false, error: true } }));
    }
  };

  const createClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await clientAPI.register(formData);
      const newClient = response.client;
      
      // Store client ID for demo
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
      // Refresh auth status after OAuth
      setTimeout(() => loadAuthStatus(clientId), 2000);
    } catch (error: any) {
      console.error('Failed to start OAuth:', error);
      alert(error.response?.data?.error || 'Failed to start OAuth flow');
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
    // Load auth status for all clients
    clients.forEach(client => {
      if (client.hasActiveTokens) {
        loadAuthStatus(client.id);
      }
    });
  }, [clients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Client Management</h2>
          <p className="text-gray-600">Manage your AI email agent clients and their Microsoft 365 connections</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn-primary flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </button>
      </div>

      {/* Create Client Form */}
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

      {/* Client List */}
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
                    </div>
                    <p className="text-gray-600">{client.email}</p>
                    <p className="text-sm text-gray-500">{client.companyName}</p>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Created: {new Date(client.createdAt).toLocaleDateString()}</span>
                      <span>Status: {status?.isConnected ? 'Connected' : 'Disconnected'}</span>
                      {status?.tokenExpired && (
                        <span className="text-red-500">Token Expired</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
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
                        {status?.tokenExpired && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              refreshTokens(client.id);
                            }}
                            className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-md hover:bg-yellow-200"
                            title="Refresh Tokens"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        )}
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