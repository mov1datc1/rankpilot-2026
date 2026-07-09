'use client';

import { useState, useEffect } from 'react';
import { BarChart2, FileText, Zap, CheckCircle2, Clock, TrendingUp, ArrowUpRight } from 'lucide-react';
import { getDashboardStats } from '@/app/actions/dashboard';
import Link from 'next/link';

type RecentSub = {
  id: string;
  targetDirectory: string;
  practiceArea: string;
  guideRegion: string;
  mattersCount: number;
  optimizedCount: number;
  createdAt: Date | string;
};

export default function DashboardAnalyticsPage() {
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    totalMatters: 0,
    optimizedMatters: 0,
    readySubmissions: 0,
    recentSubmissions: [] as RecentSub[]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getDashboardStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  const kpiCards = [
    { label: 'Total Submissions', value: stats.totalSubmissions, icon: FileText, color: '#2563eb', bg: '#eff6ff' },
    { label: 'Total Matters', value: stats.totalMatters, icon: Zap, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'AI Optimized', value: stats.optimizedMatters, icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
    { label: 'Ready to Send', value: stats.readySubmissions, icon: TrendingUp, color: '#ea580c', bg: '#fff7ed' },
  ];

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <BarChart2 size={40} color="#2563eb" />
          <span style={{ color: '#64748b', fontWeight: 600 }}>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          RankPilot: <span style={{ color: '#2563eb' }}>Dashboard</span>
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#64748b', marginTop: '0.25rem' }}>
          Overview of your submission pipeline and AI optimization performance.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '1.5rem',
              boxShadow: '0 2px 4px -1px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color={kpi.color} />
                </div>
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>{kpi.value}</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 500 }}>{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Recent Submissions Table */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 2px 4px -1px rgba(0,0,0,0.03)'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Recent Submissions</h2>
          <Link href="/submissions" style={{
            color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '0.25rem'
          }}>
            View all <ArrowUpRight size={14} />
          </Link>
        </div>

        {stats.recentSubmissions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            No submissions yet. Start by creating one in the Builder.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Directory</th>
                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Practice Area</th>
                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progress</th>
                <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentSubmissions.map((sub) => {
                const progress = sub.mattersCount > 0 ? Math.round((sub.optimizedCount / sub.mattersCount) * 100) : 0;
                const isReady = sub.mattersCount > 0 && progress === 100;
                return (
                  <tr key={sub.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 500, color: '#0f172a' }}>{sub.targetDirectory}</td>
                    <td style={{ padding: '1rem 1.5rem', color: '#475569', fontSize: '0.9rem' }}>{sub.practiceArea} · {sub.guideRegion}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', maxWidth: '120px' }}>
                          <div style={{ height: '100%', width: `${progress}%`, background: isReady ? '#16a34a' : '#2563eb', borderRadius: '999px' }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563eb' }}>{progress}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{
                        padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                        background: isReady ? '#dcfce7' : '#fef3c7',
                        color: isReady ? '#15803d' : '#92400e',
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem'
                      }}>
                        {isReady ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {isReady ? 'Ready' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
