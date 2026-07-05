import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function LogsPage() {
  const [queues, setQueues] = useState<any[]>([]);
  const [selectedQueue, setSelectedQueue] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/orgs').then(async r => {
      const o = r.data.data?.[0]; if (!o) return;
      const p = await api.get(`/orgs/${o.id}/projects`);
      const pr = p.data.data?.[0]; if (!pr) return;
      const q = await api.get(`/projects/${pr.id}/queues`);
      setQueues(q.data.data);
      if (q.data.data[0]) setSelectedQueue(q.data.data[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedQueue) api.get(`/queues/${selectedQueue.id}/jobs`, { params: { limit: 50 } }).then(r => setJobs(r.data.data)).catch(() => {});
  }, [selectedQueue]);

  useEffect(() => {
    if (selectedJob) api.get(`/jobs/${selectedJob.id}/logs`).then(r => setLogs(r.data.data)).catch(() => {});
  }, [selectedJob]);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Execution Logs</h1><p className="page-subtitle">Browse job execution history and logs</p></div>
      </div>
      <div className="logs-grid">
        <div className="card log-panel" style={{padding:0}}>
          <div className="log-panel-header">Queues</div>
          {queues.map(q => (
            <div key={q.id} className={`log-item${selectedQueue?.id === q.id ? ' active' : ''}`}
              onClick={() => { setSelectedQueue(q); setSelectedJob(null); setLogs([]); }}>
              <p className="log-item-name" style={{color: selectedQueue?.id === q.id ? '#60a5fa' : '#fff'}}>{q.name}</p>
            </div>
          ))}
        </div>

        <div className="card log-panel" style={{padding:0}}>
          <div className="log-panel-header">Jobs</div>
          {jobs.map(j => (
            <div key={j.id} className={`log-item${selectedJob?.id === j.id ? ' active' : ''}`} onClick={() => setSelectedJob(j)}>
              <p className="log-item-name" style={{color: selectedJob?.id === j.id ? '#60a5fa' : '#fff'}}>{j.name}</p>
              <p className="log-item-meta">{j.status} · {new Date(j.createdAt).toLocaleTimeString()}</p>
            </div>
          ))}
          {jobs.length === 0 && <div style={{padding:'1rem', color:'var(--gray-500)', fontSize:'0.85rem'}}>No jobs in queue.</div>}
        </div>

        <div className="card log-panel" style={{padding:0}}>
          <div className="log-panel-header">Log Output</div>
          <div className="log-output">
            {logs.map(l => (
              <div key={l.id} className={`log-line ${l.level}`}>
                <span className="log-time">{new Date(l.createdAt).toLocaleTimeString()}</span>
                <strong>[{l.level?.toUpperCase()}]</strong> {l.message}
              </div>
            ))}
            {logs.length === 0 && <p style={{fontSize:'0.8rem', color:'var(--gray-600)', fontFamily:'monospace'}}>{selectedJob ? 'No logs for this job.' : 'Select a job to view logs.'}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
