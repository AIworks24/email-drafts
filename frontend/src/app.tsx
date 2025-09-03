import React, { useState } from 'react';
import { Users, Mail, Settings, BarChart } from 'lucide-react';
import ClientManager from './components/ClientManager';
import EmailDashboard from './components/EmailDashboard';
import TemplateManager from './components/TemplateManager';
import UsageReporting from './components/UsageReporting';

type Tab = 'clients' | 'emails' | 'templates' | 'reports';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('clients');
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const tabs = [
    { id: 'clients' as Tab, name: 'Clients', icon: Users },
    { id: 'emails' as Tab, name: 'Emails', icon: Mail },
    { id: 'templates' as Tab, name: 'Templates', icon: Settings },
    { id: 'reports' as Tab, name: 'Reports', icon: BarChart },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-primary-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">AI Email Drafts Agent</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Service Provider Dashboard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`${
                    isActive
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'clients' && (
          <ClientManager 
            selectedClientId={selectedClientId}
            onClientSelect={setSelectedClientId}
          />
        )}
        {activeTab === 'emails' && (
          <EmailDashboard 
            selectedClientId={selectedClientId}
          />
        )}
        {activeTab === 'templates' && (
          <TemplateManager 
            selectedClientId={selectedClientId}
          />
        )}
        {activeTab === 'reports' && (
          <UsageReporting 
            selectedClientId={selectedClientId}
          />
        )}
      </div>
    </div>
  );
}

export default App;