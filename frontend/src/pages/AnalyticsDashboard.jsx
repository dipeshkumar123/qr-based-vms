import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { apiClient, getWithSWR } from '../lib/api';

const ANALYTICS_SNAPSHOT_KEY = 'ii_vms_analytics_snapshot';

function saveSnapshot(snapshot) {
  try {
    localStorage.setItem(ANALYTICS_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures
  }
}

function loadSnapshot() {
  try {
    const raw = localStorage.getItem(ANALYTICS_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [peakHours, setPeakHours] = useState(null);
  const [frequentVisitors, setFrequentVisitors] = useState(null);
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  const [trends, setTrends] = useState(null);
  const [statusDistribution, setStatusDistribution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [partialErrors, setPartialErrors] = useState([]);
  const [days, setDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const hasLoadedRef = useRef(false);

  const downloadTemplate = async (templateId) => {
    try {
      const response = await apiClient.get(`/api/admin/export-template/${templateId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${templateId}-template.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download export template:', error);
    }
  };

  const applyPayload = (payload) => {
    setAnalytics(payload.report || { summary: {} });
    setPeakHours(payload.peakHours || { forecast: {}, peak_hours: [], error: null });
    setFrequentVisitors(payload.frequentVisitors || []);
    setSuspiciousActivity(payload.suspiciousActivity || { suspicious_visitors: [] });
    setTrends(Array.isArray(payload.trends) ? payload.trends : []);
    setStatusDistribution(Array.isArray(payload.statusDistribution) ? payload.statusDistribution : []);
    setPartialErrors(Array.isArray(payload.partialErrors) ? payload.partialErrors : []);
    setCacheInfo(payload.cache || null);
    setLastUpdated(new Date());

    saveSnapshot({
      report: payload.report || { summary: {} },
      peakHours: payload.peakHours || { forecast: {}, peak_hours: [], error: null },
      frequentVisitors: payload.frequentVisitors || [],
      suspiciousActivity: payload.suspiciousActivity || { suspicious_visitors: [] },
      trends: Array.isArray(payload.trends) ? payload.trends : [],
      statusDistribution: Array.isArray(payload.statusDistribution) ? payload.statusDistribution : [],
      cache: payload.cache || null,
      savedAt: new Date().toISOString(),
    });
  };

  const fetchAnalytics = useCallback(async (forceNetwork = false) => {
    const isInitialLoad = !hasLoadedRef.current;
    try {
      if (isInitialLoad) setLoading(true);
      else setRefreshing(true);
      setError(null);

      const swr = await getWithSWR('/api/analytics/dashboard', {
        params: { days },
        ttlMs: 25_000,
        staleMs: 5 * 60_000,
        forceNetwork,
        onUpdate: (fresh) => {
          applyPayload(fresh || {});
          setRefreshing(false);
        },
      });

      const payload = swr?.data || {};
      applyPayload(payload);
      if (swr?.cache?.stale && !forceNetwork) {
        setPartialErrors((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          if (!next.includes('Refreshing stale cache')) next.push('Refreshing stale cache');
          return next;
        });
      }
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Analytics fetch error:', err);
      const snapshot = loadSnapshot();
      if (snapshot) {
        setAnalytics(snapshot.report || { summary: {} });
        setPeakHours(snapshot.peakHours || { forecast: {}, peak_hours: [], error: null });
        setFrequentVisitors(snapshot.frequentVisitors || []);
        setSuspiciousActivity(snapshot.suspiciousActivity || { suspicious_visitors: [] });
        setTrends(Array.isArray(snapshot.trends) ? snapshot.trends : []);
        setStatusDistribution(Array.isArray(snapshot.statusDistribution) ? snapshot.statusDistribution : []);
        setCacheInfo({ ...(snapshot.cache || {}), hit: true, stale: true, offline: true });
        setPartialErrors((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          if (!next.includes('Offline snapshot')) next.push('Offline snapshot');
          return next;
        });
        setError('Network issue detected. Showing last cached analytics snapshot.');
      } else {
        setError('Failed to load analytics data. Please try again.');
      }
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !analytics) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 pt-24 pb-12 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-1">Analytics Dashboard</h1>
            <p className="text-slate-400 text-sm">Comprehensive visitor analytics and AI-powered insights</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {cacheInfo?.hit && (
              <span className="text-xs text-amber-300">
                {cacheInfo?.stale ? 'Stale cached data' : 'Cached snapshot'}
              </span>
            )}
            <button
              onClick={() => downloadTemplate('analytics_summary')}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-semibold transition"
            >
              Export Template
            </button>
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={loading || refreshing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 flex items-center gap-2"
            >
              <svg
                className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {refreshing && (
          <div className="mb-4 text-xs text-slate-400">Refreshing analytics in background...</div>
        )}

        {/* Time Period Selector */}
        <div className="mb-8 flex flex-wrap gap-2">
          {[7, 14, 30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                days === d
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-700/60 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-200">
            <p className="font-medium">Error loading analytics</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {partialErrors.length > 0 && !error && (
          <div className="mb-6 p-3 bg-amber-900/30 border border-amber-700 rounded-lg text-amber-200 text-sm">
            Some data could not be loaded: {partialErrors.join(', ')}
          </div>
        )}

        {/* Key Metrics */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-800/60 backdrop-blur p-5 rounded-2xl border border-slate-700/50">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Visitors</p>
              <p className="text-3xl font-extrabold text-white mt-2 stat-number">
                {analytics.summary?.total_visitors ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Last {days} days</p>
            </div>

            <div className="bg-slate-800/60 backdrop-blur p-5 rounded-2xl border border-slate-700/50">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Avg Daily</p>
              <p className="text-3xl font-extrabold text-white mt-2 stat-number">
                {analytics.summary?.avg_daily_visitors ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Per day average</p>
            </div>

            <div className="bg-slate-800/60 backdrop-blur p-5 rounded-2xl border border-slate-700/50">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Repeat Visitors</p>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2 stat-number">
                {frequentVisitors?.length ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Frequent visitors</p>
            </div>

            <div className="bg-slate-800/60 backdrop-blur p-5 rounded-2xl border border-slate-700/50">
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Suspicious</p>
              <p className="text-3xl font-extrabold text-amber-400 mt-2 stat-number">
                {suspiciousActivity?.suspicious_visitors?.length ?? 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Flagged visitors</p>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Status Distribution */}
          {statusDistribution && statusDistribution.length > 0 && (
            <div className="bg-slate-800/60 backdrop-blur p-6 rounded-2xl border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4">Visitor Status Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution.map((s) => ({
                      name: s.status,
                      value: s.count,
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    dataKey="value"
                  >
                    {statusDistribution.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend wrapperStyle={{ color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Peak Hours */}
          <div className="bg-slate-800/60 backdrop-blur p-6 rounded-2xl border border-slate-700/50">
            <h2 className="text-xl font-bold text-white mb-4">Peak Hours Forecast</h2>
            {peakHoursData.length > 0 ? (
              <>
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
                {peakHours?.peak_hours && peakHours.peak_hours.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-900/30 rounded-lg border border-blue-700">
                    <p className="text-sm text-blue-200">
                      <span className="font-bold">Peak Hours:</span>{' '}
                      {peakHours.peak_hours.map((h) => `${h}:00`).join(', ')}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <p className="text-sm mb-2">Insufficient data to forecast peak hours</p>
                  <p className="text-xs text-slate-500">Need more visitor activity history</p>
                </div>
              </div>
            )}
          </div>

          {/* Visitor Trends */}
          <div className="bg-slate-800/60 backdrop-blur p-6 rounded-2xl border border-slate-700/50">
            <h2 className="text-xl font-bold text-white mb-4">Visitor Trends</h2>
            {trendsData.length > 0 ? (
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
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                <div className="text-center">
                  <p className="text-sm mb-2">No visitor trend data available</p>
                  <p className="text-xs text-slate-500">Trends will appear as data accumulates</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Frequent Visitors Table */}
        <div className="bg-slate-800/60 backdrop-blur p-6 rounded-2xl border border-slate-700/50 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Frequent Visitors</h2>
          {frequentVisitors && frequentVisitors.length > 0 ? (
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
          ) : (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm mb-1">No frequent visitors yet</p>
              <p className="text-xs text-slate-500">Visitors with multiple check-ins will appear here</p>
            </div>
          )}
        </div>

        {/* Suspicious Activity Alerts */}
        <div className="bg-slate-800/60 backdrop-blur p-6 rounded-2xl border border-slate-700/50">
          {suspiciousActivity?.suspicious_visitors && suspiciousActivity.suspicious_visitors.length > 0 ? (
            <>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse"></span>
                Suspicious Activity ({suspiciousActivity.suspicious_visitors.length})
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
                        <div className="flex gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                          <span>Visits: {visitor.visitCount || 0}</span>
                          <span>Failed: {visitor.failedVerifications || 0}</span>
                          <span>Frequency: {visitor.visitFrequency?.toFixed(2) || 0}/day</span>
                          <span>Score: {Math.abs(visitor.suspicionScore || 0).toFixed(3)}</span>
                        </div>
                      </div>
                      <span className="text-2xl flex-shrink-0">⚠️</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-green-400 font-medium mb-2 text-lg">✓ No Suspicious Activity</p>
              <p className="text-slate-400 text-sm">All visitor patterns appear normal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
