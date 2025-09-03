import React, { useState, useEffect } from 'react';
import { BarChart, Calendar, TrendingUp, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface UsageStats {
  date: string;
  emailsProcessed: number;
  responsesGenerated: number;
  responsesSent: number;
  responsesEdited: number;
}

interface ClientUsage {
  clientId: string;
  clientName: string;
  companyName: string;
  totalEmails: number;
  totalResponses: number;
  responseRate: number;
  avgResponseTime: number;
  lastActive: string;
  isActive: boolean;
}

interface UsageReportingProps {
  selectedClientId: string;
}

export default function UsageReporting({ selectedClientId }: UsageReportingProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [clientUsage, setClientUsage] = useState<ClientUsage[]>([]);
  const [dailyStats, setDailyStats] = useState<UsageStats[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalClients: 0,
    activeClients: 0,
    totalEmailsProcessed: 0,
    totalResponsesGenerated: 0,
    avgResponseRate: 0,
    avgResponseTime: 0
  });
  const [loading, setLoading] = useState(false);

  // Mock data for demo - replace with API calls
  useEffect(() => {
    loadUsageData();
  }, [timeRange, selectedClientId]);

  const loadUsageData = async () => {
    setLoading(true);
    
    // Mock client usage data
    const mockClientUsage: ClientUsage[] = [
      {
        clientId: 'client1',
        clientName: 'John Doe',
        companyName: 'TechCorp',
        totalEmails: 45,
        totalResponses: 38,
        responseRate: 84.4,
        avgResponseTime: 3.2,
        lastActive: '2024-01-15T10:30:00Z',
        isActive: true
      },
      {
        clientId: 'client2',
        clientName: 'Jane Smith',
        companyName: 'ConsultingCo',
        totalEmails: 23,
        totalResponses: 21,
        responseRate: 91.3,
        avgResponseTime: 2.8,
        lastActive: '2024-01-14T16:20:00Z',
        isActive: true
      },
      {
        clientId: 'client3',
        clientName: 'Mike Johnson',
        companyName: 'StartupInc',
        totalEmails: 12,
        totalResponses: 8,
        responseRate: 66.7,
        avgResponseTime: 4.1,
        lastActive: '2024-01-10T09:15:00Z',
        isActive: false
      }
    ];

    // Mock daily stats
    const mockDailyStats: UsageStats[] = Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      emailsProcessed: Math.floor(Math.random() * 15) + 5,
      responsesGenerated: Math.floor(Math.random() * 12) + 3,
      responsesSent: Math.floor(Math.random() * 10) + 2,
      responsesEdited: Math.floor(Math.random() * 5) + 1
    }));

    // Calculate totals
    const totalEmailsProcessed = mockDailyStats.reduce((sum, day) => sum + day.emailsProcessed, 0);
    const totalResponsesGenerated = mockDailyStats.reduce((sum, day) => sum + day.responsesGenerated, 0);
    const activeClients = mockClientUsage.filter(c => c.isActive).length;
    const avgResponseRate = mockClientUsage.reduce((sum, c) => sum + c.responseRate, 0) / mockClientUsage.length;
    const avgResponseTime = mockClientUsage.reduce((sum, c) => sum + c.avgResponseTime, 0) / mockClientUsage.length;

    setClientUsage(selectedClientId ? mockClientUsage.filter(c => c.clientId === selectedClientId) : mockClientUsage);
    setDailyStats(mockDailyStats);
    setTotalStats({
      totalClients: mockClientUsage.length,
      activeClients,
      totalEmailsProcessed,
      totalResponsesGenerated,
      avgResponseRate,
      avgResponseTime
    });
    
    setLoading(false);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getStatusColor = (responseRate: number) => {
    if (responseRate >= 80) return 'text-green-600 bg-green-100';
    if (responseRate >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Usage Reports</h2>
          <p className="text-gray-600">Monitor AI email agent performance and usage statistics</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="input-field w-auto"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Emails Processed</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalStats.totalEmailsProcessed)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Responses Generated</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalStats.totalResponsesGenerated)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Response Rate</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.avgResponseRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">{totalStats.avgResponseTime.toFixed(1)}min</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Activity Chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Daily Activity</h3>
          <Calendar className="h-5 w-5 text-gray-500" />
        </div>
        
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-gray-500">Loading chart data...</p>
          </div>
        ) : (
          <div className="h-64 overflow-x-auto">
            <div className="flex items-end space-x-2 h-full min-w-max pb-4">
              {dailyStats.slice(-14).map((day, index) => {
                const maxEmails = Math.max(...dailyStats.map(d => d.emailsProcessed));
                const height = Math.max((day.emailsProcessed / maxEmails) * 200, 10);
                
                return (
                  <div key={day.date} className="flex flex-col items-center">
                    <div className="flex flex-col items-center space-y-1 mb-2">
                      <div
                        className="w-8 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                        style={{ height: `${height}px` }}
                        title={`${day.emailsProcessed} emails processed`}
                      />
                      <div
                        className="w-8 bg-green-500 rounded-b hover:bg-green-600 transition-colors"
                        style={{ height: `${Math.max((day.responsesGenerated / maxEmails) * 200, 5)}px` }}
                        title={`${day.responsesGenerated} responses generated`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 transform rotate-45 whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center space-x-4 mt-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Emails Processed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Responses Generated</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Client Performance Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">
            {selectedClientId ? 'Selected Client Performance' : 'Client Performance Overview'}
          </h3>
          <BarChart className="h-5 w-5 text-gray-500" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Emails
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Responses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Response Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientUsage.map((client) => (
                <tr key={client.clientId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{client.clientName}</div>
                      <div className="text-sm text-gray-500">{client.companyName}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(client.totalEmails)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(client.totalResponses)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(client.responseRate)}`}>
                      {client.responseRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {client.avgResponseTime.toFixed(1)}min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(client.lastActive).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.isActive ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}