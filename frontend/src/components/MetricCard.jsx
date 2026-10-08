import { ArrowUpRight } from 'lucide-react';

export function MetricCard({ label, value, icon: Icon, tone, foot, trend, up }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div><span className="metric-label">{label}</span><div className="metric-value-row"><b>{value}</b><span className={`metric-trend ${up ? 'trend-up' : ''}`}>{up ? <ArrowUpRight size={13} /> : null}{trend}</span></div><span className="metric-foot">{foot}</span></article>;
}
