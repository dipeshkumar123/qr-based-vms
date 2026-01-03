import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import LoadingSpinner from '../components/LoadingSpinner';
import { apiClient as api } from '../lib/api';

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [frequentVisitors, setFrequentVisitors] = useState(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [reportRes, peakRes, frequentRes, suspiciousRes, trendsRes] = await Promise.all([
        api.get(`/api/analytics/report?days=${days}`),
        api.get(`/api/analytics/peak-hours?days=${days}`),
        api.get(`/api/analytics/frequent-visitors?limit=10`),
        api.get(`/api/analytics/suspicious-activity?threshold=0.05`),
        api.get(`/api/analytics/trends?days=${days}`),
      ]);

      setAnalytics(reportRes.data);
      setPeakHours(peakRes.data);
      setFrequentVisitors(frequentRes.data?.visitors || []);
      setSuspiciousActivity(suspiciousRes.data);
      setTrends(trendsRes.data?.trends || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Prepare peak hours chart data
  const peakHoursData = peakHours?.forecast
    ? Object.entries(peakHours.forecast).map(([hour, count]) => ({
        hour: `${hour}:00`,
        visits: Math.round(count),
      }))
    : [];

  // Prepare trends chart data
  const trendsData = Array.isArray(trends)
    ? trends.map((item) => ({
        date: item.date || item.day,
        count: item.count,
      }))
    : [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Analytics Dashboard</h1>
          <p className="text-slate-400">Comprehensive visitor analytics and insights</p>
        </div>

        {/* Time Period Selector */}
        <div className="mb-6 flex gap-4">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
            <p className="font-medium">Error loading analytics</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Key Metrics */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
              <p className="text-slate-400 text-sm font-medium">Total Visitors</p>
              <p className="text-3xl font-bold text-white mt-2">
                {analytics.summary?.total_visitors ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-2">Last {days} days</p>
            </div>

            <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
              <p className="text-slate-400 text-sm font-medium">Avg Daily Visitors</p>
              <p className="text-3xl font-bold text-white mt-2">
                {analytics.summary?.avg_daily_visitors ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-2">Per day average</p>
            </div>

            <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
              <p className="text-slate-400 text-sm font-medium">Repeat Visitors</p>
              <p className="text-3xl font-bold text-white mt-2">
                {frequentVisitors?.length ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-2">Frequent visitors</p>
            </div>

            <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
              <p className="text-slate-400 text-sm font-medium">Suspicious Activity</p>
              <p className="text-3xl font-bold text-orange-400 mt-2">
                {suspiciousActivity?.suspicious_visitors?.length ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-2">Flagged visitors</p>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Peak Hours */}
          {peakHoursData.length > 0 && (
            <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
              <h2 className="text-xl font-bold text-white mb-4">Peak Hours Forecast</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="hour" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="visits" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {peakHours?.peak_hours && (
                <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                  <p className="text-sm text-blue-200">
                    <span className="font-bold">Peak Hours:</span>{' '}
                    {peakHours.peak_hours.map((h) => `${h}:00`).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Visitor Trends */}
          {trendsData.length > 0 && (
            <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
              <h2 className="text-xl font-bold text-white mb-4">Visitor Trends</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Frequent Visitors Table */}
        {frequentVisitors && frequentVisitors.length > 0 && (
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Frequent Visitors</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">Visitor</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Visits</th>
                    <th className="text-center py-3 px-4 text-slate-400 font-medium">Visit Rate</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium">Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {frequentVisitors.slice(0, 10).map((visitor, idx) => (
                    <tr key={idx} className="border-b border-slate-600/50 hover:bg-slate-600/30">
                      <td className="py-3 px-4 text-white">{visitor.name || 'Unknown'}</td>
                      <td className="text-center py-3 px-4 text-blue-400 font-medium">
                        {visitor.visitCount}
                      </td>
                      <td className="text-center py-3 px-4 text-slate-300">
                        {visitor.visitFrequency?.toFixed(2) || 'N/A'} /day
                      </td>
                      <td className="text-right py-3 px-4 text-slate-400 text-sm">
                        {visitor.lastVisit
                          ? new Date(visitor.lastVisit).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Suspicious Activity Alerts */}
        {suspiciousActivity?.suspicious_visitors && suspiciousActivity.suspicious_visitors.length > 0 && (
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
              Suspicious Activity Detected
            </h2>
            <div className="space-y-3">
              {suspiciousActivity.suspicious_visitors.map((visitor, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-orange-900/20 border border-orange-700 rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{visitor.name || 'Unknown Visitor'}</p>
                      <p className="text-sm text-orange-300 mt-1">{visitor.reason}</p>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>Visits: {visitor.visitCount || 0}</span>
                        <span>Failed: {visitor.failedVerifications || 0}</span>
                        <span>Frequency: {visitor.visitFrequency?.toFixed(2) || 0}/day</span>
                        <span>Score: {visitor.suspicionScore?.toFixed(3) || 0}</span>
                      </div>
                    </div>
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!suspiciousActivity?.suspicious_visitors?.length && (
          <div className="bg-slate-700/50 p-6 rounded-lg border border-slate-600">
            <div className="text-center">
              <p className="text-green-400 font-medium mb-2">✓ No Suspicious Activity</p>
              <p className="text-slate-400 text-sm">All visitor patterns appear normal</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
