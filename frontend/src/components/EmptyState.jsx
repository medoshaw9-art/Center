import { BookOpen, Plus } from 'lucide-react';

export function EmptyState({ title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><BookOpen size={19} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="button button-secondary" onClick={action}><Plus size={16} />إضافة الآن</button>}</div>;
}
