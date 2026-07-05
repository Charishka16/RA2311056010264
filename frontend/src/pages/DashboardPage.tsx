import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Activity, Briefcase, Layers, Users, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Metrics {
  totalJobs: number;
  jobsByStatus: { queued: number; running: number; completed: number; failed: number; dead: number };
  activeWorkers: number; queueCount: number; dlqCount: number;
}

function StatCard({ icon: Icon, label, value, colorClass }: any) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon ${colorClass}`}><Icon size={22} style={{color: colorClass === 'blue' ? '#60a5fa' : colorClass === 'green' ? '#4ade80' : colorClass === 'red' ? '#f87171' : colorClass === 'purple' ? '#c084fc' : colorClass === 'yellow' ? '#fbbf24' : colorClass === 'orange' ? '#fb923c' : colorClass === 'indigo' ? '#818cf8' : '#fb7185'}} /></div>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [throughput, setThroughput] = useState<{timestamp: string; count: number}[]>([]);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);

  const fetchMetrics = async () => {
    try {
      const [m, t] = await Promise.all([api.get('/metrics/overview'), api.get('/metrics/throughput')]);
      setMetrics(m.data.data);
      setThroughput(t.data.data);
    } catch {}
  };

  useEffect(() => {
    fetchMetrics();
    const socket = getSocket();
    const events = ['job:created','job:claimed','job:running','job:completed','job:failed','job:dead','worker:heartbeat'];
    const handler = (event: string) => (data: any) => {
      const label = data.name || data.workerId || data.id || event;
      setLiveEvents(prev => [`${new Date().toLocaleTimeString()} — ${event}: ${label}`, ...prev].slice(0, 25));
      fetchMetrics();
    };
    events.forEach(e => socket.on(e, handler(e)));
    return () => { events.forEach(e => socket.off(e)); };
  }, []);

  const chartData = {
    labels: throughput.map(t => new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    datasets: [{ label: 'Jobs Completed', data: throughput.map(t => t.count), backgroundColor: 'rgba(59,130,246,0.55)', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 4 }]
  };
  const chartOpts: any = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(55,65,81,0.4)' } },
      y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(55,65,81,0.4)' } }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time overview of your job scheduling platform</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={Briefcase}    label="Total Jobs"     value={metrics?.totalJobs}                                          colorClass="blue" />
        <StatCard icon={CheckCircle}  label="Completed"      value={metrics?.jobsByStatus.completed}                             colorClass="green" />
        <StatCard icon={XCircle}      label="Failed / Dead"  value={metrics ? metrics.jobsByStatus.failed + metrics.jobsByStatus.dead : null} colorClass="red" />
        <StatCard icon={Users}        label="Active Workers" value={metrics?.activeWorkers}                                      colorClass="purple" />
        <StatCard icon={Clock}        label="Queued"         value={metrics?.jobsByStatus.queued}                                colorClass="yellow" />
        <StatCard icon={Activity}     label="Running"        value={metrics?.jobsByStatus.running}                               colorClass="orange" />
        <StatCard icon={Layers}       label="Queues"         value={metrics?.queueCount}                                         colorClass="indigo" />
        <StatCard icon={AlertTriangle}label="DLQ"            value={metrics?.dlqCount}                                           colorClass="rose" />
      </div>

      <div className="charts-grid">
        <div className="card">
          <h3 style={{color:'#fff', fontWeight:600, marginBottom:'1rem'}}>Throughput (Last 24h)</h3>
          <div style={{height: 220}}>
            {throughput.length > 0
              ? <Bar data={chartData} options={chartOpts} />
              : <div style={{height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--gray-500)'}}>No data yet — complete some jobs!</div>
            }
          </div>
        </div>

        <div className="card" style={{display:'flex', flexDirection:'column'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:'1rem'}}>
            <div className="status-dot" />
            <h3 style={{color:'#fff', fontWeight:600}}>Live Feed</h3>
          </div>
          <div className="live-feed">
            {liveEvents.length === 0
              ? <p style={{fontSize:'0.8rem', color:'var(--gray-500)', fontStyle:'italic'}}>Waiting for events...</p>
              : liveEvents.map((e, i) => <div key={i} className="live-event">{e}</div>)
            }
          </div>
        </div>
      </div>
    </div>
  );
}
