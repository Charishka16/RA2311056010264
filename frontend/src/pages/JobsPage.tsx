import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import { getSocket } from '../lib/socket';
import { RefreshCw, Plus, Search, Briefcase, Clock, CheckCircle, XCircle, Zap, SkipForward } from 'lucide-react';

const STATUS_META: Record<string, { label: string; cls: string; color: string }> = {
  QUEUED:    { label:'Queued',    cls:'badge-queued',    color:'#60a5fa' },
  RUNNING:   { label:'Running',   cls:'badge-running',   color:'#fbbf24' },
  CLAIMED:   { label:'Claimed',   cls:'badge-claimed',   color:'#fb923c' },
  COMPLETED: { label:'Completed', cls:'badge-completed', color:'#4ade80' },
  FAILED:    { label:'Failed',    cls:'badge-failed',    color:'#f87171' },
  DEAD:      { label:'Dead',      cls:'badge-dead',      color:'#6b7280' },
  CANCELLED: { label:'Cancelled', cls:'badge-cancelled', color:'#4b5563' },
  SCHEDULED: { label:'Scheduled', cls:'badge-queued',    color:'#818cf8' },
};

const ALL_STATUSES = Object.keys(STATUS_META);

export default function JobsPage() {
  const [queues, setQueues]           = useState<any[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<any>(null);
  const [jobs, setJobs]               = useState<any[]>([]);
  const [pagination, setPagination]   = useState({ page:1, limit:15, total:0, totalPages:1 });
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [jobForm, setJobForm] = useState({ name:'', type:'IMMEDIATE', priority:0, duration:2000, failRate:0.05, maxRetries:3 });

  // Load orgs → projects → queues on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/orgs');
        const o = r.data.data?.[0]; if (!o) return;
        const p = await api.get(`/orgs/${o.id}/projects`);
        const pr = p.data.data?.[0]; if (!pr) return;
        const q = await api.get(`/projects/${pr.id}/queues`);
        setQueues(q.data.data);
        if (q.data.data.length > 0) setSelectedQueue(q.data.data[0]);
      } catch {}
    })();
  }, []);

  const fetchJobs = useCallback(async (page: number, queueId?: string, status?: string) => {
    const qId = queueId ?? selectedQueue?.id;
    if (!qId) return;
    setLoading(true);
    try {
      const params: any = { page, limit: pagination.limit };
      if (status ?? filterStatus) params.status = (status ?? filterStatus);
      const r = await api.get(`/queues/${qId}/jobs`, { params });
      setJobs(r.data.data);
      setPagination(r.data.pagination);
    } catch {} finally { setLoading(false); }
  }, [selectedQueue, filterStatus, pagination.limit]);

  useEffect(() => {
    if (selectedQueue) fetchJobs(1, selectedQueue.id, filterStatus);
  }, [selectedQueue, filterStatus]);

  // Real-time updates
  useEffect(() => {
    const s = getSocket();
    const refresh = () => { if (selectedQueue) fetchJobs(pagination.page); };
    const events = ['job:created','job:claimed','job:running','job:completed','job:failed','job:dead'];
    events.forEach(e => s.on(e, refresh));
    return () => events.forEach(e => s.off(e, refresh));
  }, [selectedQueue, pagination.page, fetchJobs]);

  const createJob = async () => {
    if (!selectedQueue || !jobForm.name) return;
    setCreating(true);
    try {
      await api.post(`/queues/${selectedQueue.id}/jobs`, {
        name: jobForm.name, type: jobForm.type,
        priority: jobForm.priority, maxRetries: jobForm.maxRetries,
        payload: { duration: jobForm.duration, failRate: jobForm.failRate }
      });
      setShowCreate(false);
      setJobForm({ name:'', type:'IMMEDIATE', priority:0, duration:2000, failRate:0.05, maxRetries:3 });
      fetchJobs(1);
    } catch {} finally { setCreating(false); }
  };

  const createBatchJobs = async () => {
    if (!selectedQueue) return;
    setCreating(true);
    const batchNames = ['Process CSV', 'Send Email', 'Generate Report', 'Sync Data', 'Cleanup Temp'];
    try {
      await api.post(`/queues/${selectedQueue.id}/jobs/batch`, {
        jobs: batchNames.map((n, i) => ({ name: n, type: 'IMMEDIATE', priority: i, payload: { duration: 1500 + i*300, failRate: 0.05 } }))
      });
      fetchJobs(1);
    } catch {} finally { setCreating(false); }
  };

  const retry  = async (id: string) => { try { await api.post(`/jobs/${id}/retry`);  fetchJobs(pagination.page); } catch {} };
  const cancel = async (id: string) => { try { await api.post(`/jobs/${id}/cancel`); fetchJobs(pagination.page); } catch {} };

  const statusCounts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = jobs.filter(j => j.status === s).length;
    return acc;
  }, {} as Record<string,number>);

  const filteredJobs = search
    ? jobs.filter(j => j.name.toLowerCase().includes(search.toLowerCase()))
    : jobs;

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Jobs</h1><p className="page-subtitle">Browse, create and manage job executions in real-time</p></div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => fetchJobs(pagination.page)}><RefreshCw size={14}/></button>
          {selectedQueue && <>
            <button className="btn btn-secondary" onClick={createBatchJobs} disabled={creating}>
              <SkipForward size={14}/>Batch (5 jobs)
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14}/>Create Job
            </button>
          </>}
        </div>
      </div>

      {/* Queue selector tabs */}
      {queues.length > 0 && (
        <div className="filters-row">
          {queues.map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQueue(q)}
              className={`filter-tab${selectedQueue?.id === q.id ? ' active' : ''}`}
            >
              {q.name}
            </button>
          ))}
        </div>
      )}

      {/* Status filter + search row */}
      <div style={{display:'flex', gap:'0.75rem', marginBottom:'1rem', flexWrap:'wrap', alignItems:'center'}}>
        <div style={{position:'relative', flex:'1', minWidth:180}}>
          <Search size={14} style={{position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--gray-600)'}} />
          <input
            className="input"
            style={{paddingLeft:'2rem'}}
            placeholder="Search jobs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); fetchJobs(1, selectedQueue?.id, e.target.value); }}>
          <option value="">All Status</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      {/* Quick status summary pills */}
      {selectedQueue && (
        <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem'}}>
          {ALL_STATUSES.filter(s => statusCounts[s] > 0).map(s => (
            <span key={s} className={`badge ${STATUS_META[s].cls}`} style={{cursor:'pointer'}} onClick={() => setFilterStatus(s === filterStatus ? '' : s)}>
              {STATUS_META[s].label} {statusCounts[s]}
            </span>
          ))}
          {jobs.length === 0 && !loading && (
            <span style={{color:'var(--gray-600)', fontSize:'0.8rem'}}>No jobs in this filter</span>
          )}
        </div>
      )}

      {/* Jobs table */}
      <div className="table-wrapper">
        {loading && (
          <div style={{padding:'2rem', textAlign:'center', color:'var(--gray-500)'}}>
            <div style={{width:24, height:24, border:'2px solid #2563eb', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto'}} />
          </div>
        )}
        {!loading && (
          <table>
            <thead><tr>
              <th>Name</th><th>Status</th><th>Type</th><th>Priority</th>
              <th>Attempts</th><th>Duration</th><th>Created</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filteredJobs.map(j => {
                const sm = STATUS_META[j.status] || STATUS_META.QUEUED;
                const dur = j.completedAt && j.startedAt
                  ? `${((new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime())/1000).toFixed(1)}s`
                  : j.startedAt ? 'Running…' : '—';
                return (
                  <tr key={j.id}>
                    <td>
                      <div style={{fontWeight:600, color:'#fff'}}>{j.name}</div>
                      {j.errorMessage && <div style={{fontSize:'0.7rem', color:'var(--red-400)', marginTop:2, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={j.errorMessage}>{j.errorMessage}</div>}
                    </td>
                    <td><span className={`badge ${sm.cls}`}>{sm.label}</span></td>
                    <td style={{color:'var(--gray-400)', fontSize:'0.8rem'}}>{j.type}</td>
                    <td>
                      <span style={{color: j.priority > 5 ? '#fbbf24' : 'var(--gray-400)', fontWeight: j.priority > 5 ? 700 : 400}}>
                        {j.priority}
                      </span>
                    </td>
                    <td style={{color:'var(--gray-400)'}}>{j.attempt}/{j.maxRetries}</td>
                    <td style={{color:'var(--gray-500)', fontSize:'0.8rem'}}>{dur}</td>
                    <td style={{color:'var(--gray-500)', fontSize:'0.75rem'}}>{new Date(j.createdAt).toLocaleTimeString()}</td>
                    <td>
                      <div style={{display:'flex', gap:4}}>
                        {(j.status === 'FAILED' || j.status === 'DEAD') && (
                          <button onClick={() => retry(j.id)} className="btn btn-sm btn-primary">↺ Retry</button>
                        )}
                        {(j.status === 'QUEUED' || j.status === 'SCHEDULED') && (
                          <button onClick={() => cancel(j.id)} className="btn btn-sm btn-danger">✕ Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredJobs.length === 0 && !loading && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <Briefcase size={40} color="var(--gray-700)" style={{margin:'0 auto 1rem'}} />
                      <p>{selectedQueue ? 'No jobs match your filters. Create a job or try Batch to populate.' : 'Select a queue above to view its jobs.'}</p>
                      {selectedQueue && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14}/>Create Job</button>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        <div className="table-footer">
          <span>Showing {filteredJobs.length} of {pagination.total} jobs</span>
          <div className="flex gap-2 items-center">
            <button className="btn btn-secondary btn-sm" disabled={pagination.page <= 1} onClick={() => fetchJobs(pagination.page - 1)}>← Prev</button>
            <span style={{fontSize:'0.8rem', color:'var(--gray-400)'}}>Page {pagination.page}/{pagination.totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={pagination.page >= pagination.totalPages} onClick={() => fetchJobs(pagination.page + 1)}>Next →</button>
          </div>
        </div>
      </div>

      {/* Create Job Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal-card" style={{maxWidth:480}}>
            <h3 className="modal-title" style={{display:'flex', alignItems:'center', gap:8}}>
              <Briefcase size={18} color="#60a5fa"/>Create New Job
              <span style={{marginLeft:'auto', fontSize:'0.75rem', color:'var(--gray-500)', fontWeight:400}}>Queue: {selectedQueue?.name}</span>
            </h3>

            <div className="form-group">
              <label className="form-label">Job Name *</label>
              <input className="input" value={jobForm.name} onChange={e => setJobForm({...jobForm, name: e.target.value})} placeholder="e.g. Process Monthly Report" autoFocus />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Job Type</label>
                <select className="input" value={jobForm.type} onChange={e => setJobForm({...jobForm, type: e.target.value})}>
                  <option value="IMMEDIATE">Immediate</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="BATCH">Batch</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Priority (0–10)</label>
                <input className="input" type="number" min={0} max={10} value={jobForm.priority} onChange={e => setJobForm({...jobForm, priority: +e.target.value})} />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Max Retries</label>
                <input className="input" type="number" min={0} max={10} value={jobForm.maxRetries} onChange={e => setJobForm({...jobForm, maxRetries: +e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Duration (ms)</label>
                <input className="input" type="number" step={500} value={jobForm.duration} onChange={e => setJobForm({...jobForm, duration: +e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Failure Rate: {(jobForm.failRate*100).toFixed(0)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={jobForm.failRate}
                onChange={e => setJobForm({...jobForm, failRate: +e.target.value})}
                style={{width:'100%', accentColor:'#3b82f6'}} />
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.7rem', color:'var(--gray-600)'}}>
                <span>0% (always succeed)</span><span>100% (always fail)</span>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary w-full" onClick={createJob} disabled={!jobForm.name || creating} style={{justifyContent:'center'}}>
                {creating ? 'Creating...' : <><Zap size={14}/>Dispatch Job</>}
              </button>
              <button className="btn btn-secondary w-full" onClick={() => setShowCreate(false)} style={{justifyContent:'center'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
