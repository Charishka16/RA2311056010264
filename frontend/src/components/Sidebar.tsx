import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, LayoutDashboard, Layers, Briefcase, Users, LogOut, Activity } from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/queues', icon: Layers, label: 'Queues' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/workers', icon: Users, label: 'Workers' },
  { to: '/logs', icon: Activity, label: 'Logs' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-row">
          <div className="logo-icon"><Zap size={20} color="#fff" /></div>
          <span className="logo-text">JobForge</span>
        </div>
        <div className="status-row">
          <div className="status-dot" />
          <span className="status-label">System Operational</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={16} />{label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-row">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <div style={{minWidth:0}}>
            <p className="user-name">{user?.name}</p>
            <p className="user-email">{user?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={14} /><span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
