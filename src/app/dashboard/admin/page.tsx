import { getAdminDashboardMetrics } from '@/app/actions/admin';
import { Users, CreditCard, UserCheck, ShieldAlert, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const metrics = await getAdminDashboardMetrics();

  const kpiCards = [
    { 
      label: 'Total Usuarios', 
      value: metrics.totalUsers, 
      icon: Users, 
      color: '#38bdf8',
      bgColor: 'rgba(56, 189, 248, 0.1)',
      borderColor: 'rgba(56, 189, 248, 0.2)'
    },
    { 
      label: 'Suscripciones SaaS', 
      value: metrics.saasUsers, 
      icon: CreditCard, 
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.1)',
      borderColor: 'rgba(167, 139, 250, 0.2)'
    },
    { 
      label: 'Clientes Manuales', 
      value: metrics.manualClients, 
      icon: UserCheck, 
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.1)',
      borderColor: 'rgba(52, 211, 153, 0.2)'
    },
    { 
      label: 'Administradores', 
      value: metrics.admins, 
      icon: ShieldAlert, 
      color: '#f87171',
      bgColor: 'rgba(248, 113, 113, 0.1)',
      borderColor: 'rgba(248, 113, 113, 0.2)'
    },
  ];

  const maxCount = Math.max(...metrics.monthlyData.map(d => d.count), 1);

  return (
    <div>
      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1.25rem',
        marginBottom: '2.5rem',
      }}>
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${card.borderColor}`,
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              transition: 'transform 0.2s, border-color 0.2s',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: card.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={22} color={card.color} />
              </div>
              <div>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.15rem' }}>{card.label}</p>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Registrations Chart */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <TrendingUp size={20} color="#38bdf8" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>
            Registros Mensuales
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Últimos 6 meses</span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1.5rem',
          height: '180px',
          padding: '0 1rem',
        }}>
          {metrics.monthlyData.map((data, idx) => {
            const heightPct = maxCount > 0 ? (data.count / maxCount) * 100 : 0;
            return (
              <div key={idx} style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                height: '100%',
                justifyContent: 'flex-end',
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>{data.count}</span>
                <div style={{
                  width: '100%',
                  maxWidth: '60px',
                  height: `${Math.max(heightPct, 5)}%`,
                  background: 'linear-gradient(180deg, #38bdf8, #2563eb)',
                  borderRadius: '8px 8px 4px 4px',
                  transition: 'height 0.5s ease',
                  minHeight: '8px',
                }} />
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>
                  {data.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
