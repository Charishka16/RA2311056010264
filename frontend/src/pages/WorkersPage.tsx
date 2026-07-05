import { useEffect, useState } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);

  const fetchWorkers = async () => {
    try { const r = await api.get('/workers'); setWorkers(r.data.data); } catch {}
  };

  useEffect(() => {
    fetchWorkers();
    const s = getSocket();
    s.on('worker:heartbeat', fetchWorkers);
    return () => { s.off('worker:heartbeat', fetchWorkers); };
  }, []);

  const getStatus = (w: any) => {
    const isRecent = Date.now() - new Date(w.lastHeartbeat).getTime() < 30000;
    return isRecent ? w.status : 'OFFLINE';
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Workers</h1><p className="page-subtitle">Monitor active worker instances and heartbeats</p></div>
      </div>

      {workers.length === 0 ? (
        <div className="card empty-state"><p>No workers registered yet. Start the backend to spawn a worker.</p></div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
          {workers.map(w => {
            const status = getStatus(w);
            return (
              <div key={w.id} className="card worker-card">
                <div className="worker-info">
                  <div className="queue-dot" style={{background: status === 'ACTIVE' ? '#4ade80' : status === 'DRAINING' ? '#facc15' : '#4b5563', animation: status === 'ACTIVE' ? 'pulse 2s infinite' : 'none'}} />
                  <div>
                    <p style={{fontWeight:600, color:'#fff'}}>{w.name}</p>
                    <p style={{fontSize:'0.75rem', color:'var(--gray-500)'}}>{w.hostname} · PID {w.pid}</p>
                  </div>
                </div>
                <div className="worker-stats">
                  <div className="w-stat">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} color="#4ade80" />
                      <span className="w-stat-val">{w.jobsProcessed}</span>
                    </div>
                    <p className="w-stat-lbl">Processed</p>
                  </div>
                  <div className="w-stat">
                    <div className="flex items-center gap-2">
                      <XCircle size={14} color="#f87171" />
                      <span className="w-stat-val">{w.jobsFailed}</span>
                    </div>
                    <p className="w-stat-lbl">Failed</p>
                  </div>
                  <div className="w-stat">
                    <div className="flex items-center gap-2">
                      <Clock size={14} color="var(--gray-400)" />
                      <span className="w-stat-val" style={{fontSize:'0.8rem'}}>{new Date(w.lastHeartbeat).toLocaleTimeString()}</span>
                    </div>
                    <p className="w-stat-lbl">Last Heartbeat</p>
                  </div>
                  <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
