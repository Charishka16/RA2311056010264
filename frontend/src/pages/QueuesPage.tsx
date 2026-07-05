import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { Play, Pause, Plus, RefreshCw, Layers, Zap, CheckCircle, Clock, XCircle, AlertTriangle, Settings } from 'lucide-react';

const COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#84cc16'];

export default function QueuesPage() {
  const [org, setOrg]   = useState<any>(null);
  const [proj, setProj] = useState<any>(null);
  const [queues, setQueues]         = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<Record<string,any>>({});
  const [loading, setLoading]       = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [form, setForm] = useState({ name:'', description:'', priority: 0, concurrencyLimit: 10 });

  const fetchStats = useCallback(async (qs: any[]) => {
    const results: Record<string,any> = {};
    await Promise.all(qs.map(async q => {
      try {
        const r = await api.get(`/queues/${q.id}/stats`);
        results[q.id] = r.data.data;
      } catch {}
    }));
    setQueueStats(results);
  }, []);

  const fetchQueues = useCallback(async (pId: string) => {
    try {
      const r = await api.get(`/projects/${pId}/queues`);
      setQueues(r.data.data);
      fetchStats(r.data.data);
    } catch {}
  }, [fetchStats]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/orgs');
        const o = r.data.data?.[0];
        if (!o) { setLoading(false); return; }
        setOrg(o);
        const p = await api.get(`/orgs/${o.id}/projects`);
        const pr = p.data.data?.[0];
        if (pr) { setProj(pr); await fetchQueues(pr.id); }
      } catch {}
      setLoading(false);
    })();
  }, [fetchQueues]);

  useEffect(() => {
    const s = getSocket();
    const refresh = () => { if (proj) fetchQueues(proj.id); };
    s.on('queue:paused', refresh); s.on('queue:resumed', refresh);
    return () => { s.off('queue:paused', refresh); s.off('queue:resumed', refresh); };
  }, [proj, fetchQueues]);

  const createOrg = async () => {
    setCreating(true);
    try {
      const r = await api.post('/orgs', { name: 'My Organization' });
      const o = r.data.data; setOrg(o);
      const p = await api.post(`/orgs/${o.id}/projects`, { name: 'Main Project' });
      setProj(p.data.data); fetchQueues(p.data.data.id);
    } catch {} finally { setCreating(false); }
  };

  const createQueue = async () => {
    if (!proj || !form.name) return;
    setCreating(true);
    try {
      await api.post(`/projects/${proj.id}/queues`, form);
      fetchQueues(proj.id);
      setShowCreate(false);
      setForm({ name:'', description:'', priority: 0, concurrencyLimit: 10 });
    } catch {} finally { setCreating(false); }
  };

  const togglePause = async (q: any) => {
    try {
      await api.post(`/queues/${q.id}/${q.isPaused ? 'resume' : 'pause'}`);
      fetchQueues(proj.id);
    } catch {}
  };

  if (loading) return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:'1rem'}}>
      <div style={{width:40, height:40, border:'3px solid #2563eb', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite'}} />
      <p style={{color:'var(--gray-500)'}}>Loading queues...</p>
    </div>
  );

  if (!org) return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Queues</h1><p className="page-subtitle">Manage your job processing queues</p></div>
      </div>
      <div className="card" style={{textAlign:'center', padding:'4rem 2rem'}}>
        <div style={{marginBottom:'1rem'}}><Layers size={48} color="var(--gray-600)" style={{margin:'0 auto'}} /></div>
        <h3 style={{color:'#fff', fontWeight:600, marginBottom:'0.5rem'}}>No Organization Found</h3>
        <p style={{color:'var(--gray-500)', marginBottom:'1.5rem'}}>Create an organization and project to start managing queues.</p>
        <button className="btn btn-primary" onClick={createOrg} disabled={creating}>
          {creating ? <span className="spin" style={{width:14, height:14, border:'2px solid #fff', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block'}} /> : <Plus size={14}/>}
          Create Organization &amp; Project
        </button>
      </div>
    </div>
  );

  const totalQueued    = queues.reduce((s, q) => s + (queueStats[q.id]?.queued   || 0), 0);
  const totalRunning   = queues.reduce((s, q) => s + (queueStats[q.id]?.running  || 0), 0);
  const totalCompleted = queues.reduce((s, q) => s + (queueStats[q.id]?.completed|| 0), 0);
  const totalFailed    = queues.reduce((s, q) => s + (queueStats[q.id]?.failed   || 0), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Queues</h1>
          <p className="page-subtitle">{org.name} → {proj?.name} · {queues.length} queue{queues.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => proj && fetchQueues(proj.id)}><RefreshCw size={14}/>Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14}/>New Queue</button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="stats-grid" style={{marginBottom:'1.5rem'}}>
        {[
          { label:'Total Queues',  value: queues.length,   color:'#3b82f6', icon: Layers },
          { label:'Queued Jobs',   value: totalQueued,     color:'#f59e0b', icon: Clock },
          { label:'Running Jobs',  value: totalRunning,    color:'#10b981', icon: Zap },
          { label:'Completed',     value: totalCompleted,  color:'#4ade80', icon: CheckCircle },
          { label:'Failed',        value: totalFailed,     color:'#f87171', icon: XCircle },
          { label:'Paused',        value: queues.filter(q => q.isPaused).length, color:'#a78bfa', icon: Pause },
        ].map(s => (
          <div key={s.label} className="card stat-card">
            <div style={{background:`${s.color}22`, borderRadius:12, padding:'0.75rem', display:'flex', flexShrink:0}}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <p className="stat-label">{s.label}</p>
              <p className="stat-value">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Queue cards */}
      {queues.length === 0 ? (
        <div className="card" style={{textAlign:'center', padding:'3rem'}}>
          <Layers size={40} color="var(--gray-600)" style={{margin:'0 auto 1rem'}} />
          <p style={{color:'var(--gray-400)', marginBottom:'1rem'}}>No queues yet. Create your first queue to start processing jobs.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14}/>Create First Queue</button>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
          {queues.map((q, i) => {
            const st = queueStats[q.id] || {};
            const total = (st.total || 0) || 1;
            const completedPct = Math.round(((st.completed||0)/total)*100);
            const failedPct    = Math.round(((st.failed||0)/total)*100);
            const color = COLORS[i % COLORS.length];
            return (
              <div key={q.id} className="card" style={{padding:'1.25rem'}}>
                <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem'}}>
                  {/* Left: queue info */}
                  <div style={{display:'flex', alignItems:'flex-start', gap:'1rem', flex:1, minWidth:0}}>
                    <div style={{width:12, height:12, borderRadius:'50%', background: q.isPaused ? '#facc15' : '#4ade80', marginTop:5, flexShrink:0, boxShadow: q.isPaused ? '0 0 6px #facc15' : '0 0 6px #4ade80', animation: q.isPaused ? 'none' : 'pulse 2s infinite'}} />
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap'}}>
                        <h3 style={{fontWeight:700, color:'#fff', fontSize:'1rem'}}>{q.name}</h3>
                        <span className={`badge ${q.isPaused ? 'badge-cancelled' : 'badge-active'}`}>{q.isPaused ? 'PAUSED' : 'ACTIVE'}</span>
                        <span style={{fontSize:'0.72rem', color:'var(--gray-600)'}}>Priority {q.priority} · Max {q.concurrencyLimit} concurrent</span>
                      </div>
                      {q.description && <p style={{fontSize:'0.8rem', color:'var(--gray-500)', marginTop:4}}>{q.description}</p>}

                      {/* Progress bar */}
                      <div style={{marginTop:'0.75rem'}}>
                        <div style={{display:'flex', height:6, borderRadius:99, overflow:'hidden', background:'rgba(255,255,255,0.05)', gap:2}}>
                          <div style={{width:`${completedPct}%`, background:'#4ade80', borderRadius:99, transition:'width 0.5s'}} />
                          <div style={{width:`${failedPct}%`, background:'#f87171', borderRadius:99, transition:'width 0.5s'}} />
                        </div>
                        <div style={{display:'flex', gap:'1rem', marginTop:4, flexWrap:'wrap'}}>
                          {[
                            { lbl:'Queued',    val: st.queued    || 0, color:'#60a5fa' },
                            { lbl:'Running',   val: st.running   || 0, color:'#fbbf24' },
                            { lbl:'Completed', val: st.completed || 0, color:'#4ade80' },
                            { lbl:'Failed',    val: st.failed    || 0, color:'#f87171' },
                            { lbl:'Dead',      val: st.dead      || 0, color:'#6b7280' },
                          ].map(s => (
                            <span key={s.lbl} style={{fontSize:'0.72rem', color:'var(--gray-500)'}}>
                              <span style={{color: s.color, fontWeight:700}}>{s.val}</span> {s.lbl}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div style={{display:'flex', gap:'0.5rem', flexShrink:0}}>
                    <button
                      onClick={() => togglePause(q)}
                      className={`btn btn-sm ${q.isPaused ? 'btn-success' : 'btn-secondary'}`}
                      title={q.isPaused ? 'Resume queue' : 'Pause queue'}
                    >
                      {q.isPaused ? <><Play size={13}/>Resume</> : <><Pause size={13}/>Pause</>}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Queue Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-card">
            <h3 className="modal-title" style={{display:'flex', alignItems:'center', gap:8}}>
              <Settings size={18} color="#60a5fa"/>Create New Queue
            </h3>
            <div className="form-group">
              <label className="form-label">Queue Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. email-notifications" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Optional description" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Priority (higher = first)</label>
                <input className="input" type="number" min={0} value={form.priority} onChange={e => setForm({...form, priority: +e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Max Concurrency</label>
                <input className="input" type="number" min={1} max={100} value={form.concurrencyLimit} onChange={e => setForm({...form, concurrencyLimit: +e.target.value})} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary w-full" onClick={createQueue} disabled={!form.name || creating}>
                {creating ? 'Creating...' : <><Plus size={14}/>Create Queue</>}
              </button>
              <button className="btn btn-secondary w-full" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
