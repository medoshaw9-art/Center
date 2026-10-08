import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  UserRound,
  X,
  CalendarDays,
  Activity,
} from 'lucide-react';

const navigation = [
  { id: 'dashboard', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'teachers', label: 'المدرسون', icon: UserRound },
  { id: 'students', label: 'الطلاب', icon: GraduationCap },
  { id: 'attendance', label: 'الحضور والغياب', icon: CalendarDays },
  { id: 'reports', label: 'التقارير', icon: Activity },
];

export function Sidebar({ mobileMenu, onClose, user, isAdmin, page, dashboard, onNavigate, onLogout }) {
  const visibleNavigation = navigation.filter((item) => isAdmin || !['teachers', 'reports'].includes(item.id));

  return <>
    {mobileMenu && <button className="mobile-scrim" aria-label="إغلاق القائمة" onClick={onClose} />}
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup">
        <div className="brand-mark"><span>م</span><i /></div>
        <div><strong>مَركز</strong><small>إدارة السنتر التعليمي</small></div>
        <button className="icon-button sidebar-close" aria-label="إغلاق القائمة" onClick={onClose}><X size={19} /></button>
      </div>
      <div className="workspace-label">مساحة العمل</div>
      <div className="center-switcher">
        <div className="center-avatar">ن</div>
        <div className="center-name"><strong>سنتر النخبة</strong><small>الفرع الرئيسي</small></div>
        <ChevronDown size={15} />
      </div>
      <nav className="side-nav" aria-label="القائمة الرئيسية">
        <span className="nav-caption">القائمة</span>
        {visibleNavigation.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${page === item.id || (item.id === 'teachers' && page === 'teacher-detail') || (item.id === 'students' && page === 'student-detail') ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
            <Icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
            {item.id === 'attendance' && dashboard?.absent > 0 && <span className="nav-count">{dashboard.absent}</span>}
          </button>;
        })}
      </nav>
      <div className="sidebar-spacer" />
      <div className="support-panel">
        <div className="support-icon"><CircleHelp size={17} /></div>
        <div><strong>محتاج مساعدة؟</strong><small>تواصل مع الدعم الفني</small></div>
        <ArrowLeft size={15} />
      </div>
      <div className="sidebar-profile">
        <div className={`profile-avatar ${user.role === 'admin' ? 'avatar-admin' : ''}`}>{user.name?.slice(0, 1)}</div>
        <div className="profile-copy"><strong>{user.name}</strong><small>{isAdmin ? 'مدير السنتر' : 'مدرس'}</small></div>
        <button className="icon-button logout-button" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={onLogout}><LogOut size={17} /></button>
      </div>
    </aside>
  </>;
}
