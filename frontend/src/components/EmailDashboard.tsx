import React, { useState, useEffect } from 'react';
import { Mail, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { clientAPI, Email, AIResponse } from '../services/api';

interface EmailDashboardProps {
  selectedClientId: string;
}

export default function EmailDashboard({ selectedClientId }: EmailDashboardProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    if (selectedClientId) {
      loadEmails();
    }
  }, [selectedClientId, statusFilter]);

  const loadEmails = async () => {
    if (!selectedClientId) return;
    
    setLoading(true);
    try {
      const response = await clientAPI.getEmails(selectedClientId, {
        limit: 50,
        offset: 0,
        status: statusFilter || undefined,
      });
      setEmails(response.emails);
    } catch (error) {
      console.error('Failed to load emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'PROCESSING':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'DRAFT_CREATED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'ERROR':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Mail className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'DRAFT_CREATED':
        return 'bg-green-100 text-green-800';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!selectedClientId) {
    return (
      <div className="card text-center py-12">
        <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Select a client to view their emails</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Dashboard</h2>
          <p className="text-gray-600">Monitor processed emails and AI responses</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">All Statuses</option>
            <option value="RECEIVED">Received</option>
            <option value="PROCESSING">Processing</option>
            <option value="DRAFT_CREATED">Draft Created</option>
            <option value="ERROR">Error</option>
          </select>
          <button onClick={loadEmails} className="btn-primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recent Emails</h3>
          
          {loading ? (
            <div className="card text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Loading emails...</p>
            </div>
          ) : emails.length === 0 ? (
            <div className="card text-center py-8">
              <Mail className="h-8 w-8 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No emails found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className={`card cursor-pointer transition-all hover:shadow-lg ${
                    selectedEmail?.id === email.id ? 'ring-2 ring-primary-500' : ''
                  }`}
                  onClick={() => setSelectedEmail(email)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        {getStatusIcon(email.status)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(email.status)}`}>
                          {email.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="font-medium text-gray-900 truncate">{email.subject}</h4>
                      <p className="text-sm text-gray-600 mb-2">From: {email.sender}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(email.receivedAt).toLocaleString()}
                      </p>
                    </div>
                    {email.aiResponses.length > 0 && (
                      <div className="text-right">
                        <span className="text-xs text-gray-500">
                          {email.aiResponses.length} response{email.aiResponses.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Detail */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Email Details</h3>
          
          {selectedEmail ? (
            <div className="space-y-4">
              <div className="card">
                <div className="flex items-center space-x-2 mb-4">
                  {getStatusIcon(selectedEmail.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedEmail.status)}`}>
                    {selectedEmail.status.replace('_', ' ')}
                  </span>
                </div>
                
                <h4 className="text-lg font-semibold mb-3">{selectedEmail.subject}</h4>
                
                <div className="space-y-2 text-sm">
                  <div><strong>From:</strong> {selectedEmail.sender} ({selectedEmail.senderEmail})</div>
                  <div><strong>Received:</strong> {new Date(selectedEmail.receivedAt).toLocaleString()}</div>
                </div>
              </div>

              {/* AI Responses */}
              {selectedEmail.aiResponses.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold">AI Responses</h4>
                  {selectedEmail.aiResponses.map((response) => (
                    <div key={response.id} className="card bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(response.status)}`}>
                            {response.status.replace('_', ' ')}
                          </span>
                          {response.confidence && (
                            <span className="ml-2 text-sm text-gray-600">
                              Confidence: {Math.round(response.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(response.createdAt).toLocaleString()}
                        </span>
                      </div>
                      
                      {response.templateUsed && (
                        <div className="text-sm text-gray-600 mb-2">
                          Template: {response.templateUsed}
                        </div>
                      )}
                      
                      <div className="bg-white p-3 rounded border">
                        <div 
                          className="text-sm prose max-w-none"
                          dangerouslySetInnerHTML={{ __html: response.responseContent }}
                        />
                      </div>
                      
                      {response.draftId && (
                        <div className="mt-2 text-xs text-green-600">
                          Draft created in Outlook: {response.draftId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-12">
              <Mail className="h-8 w-8 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Select an email to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}