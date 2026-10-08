export const todayValue = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const formatDate = (value) => value ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—';

export function isAdminUser(user) { return user?.role === 'admin'; }
