import { useEffect, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowUpRight, BookOpen, CalendarDays, Check,
  CheckCheck, ChevronDown, ChevronLeft, CircleHelp, Clock3, GraduationCap, LayoutDashboard,
  LogOut, Menu, MoonStar, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Sparkles, SunMedium, Users, UserRound, UserRoundPlus, X, XCircle,
} from 'lucide-react';

const todayValue = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const formatDate = (value) => value ? new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—';

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'تعذر تنفيذ الطلب');
  return payload;
}

const navigation = [
  { id: 'dashboard', label: 'نظرة عامة', icon: LayoutDashboard },
  { id: 'teachers', label: 'المدرسون', icon: UserRound },
  { id: 'students', label: 'الطلاب', icon: GraduationCap },
  { id: 'attendance', label: 'الحضور والغياب', icon: CalendarDays },
  { id: 'reports', label: 'التقارير', icon: Activity },
];

const pageTitles = {
  dashboard: ['نظرة عامة', 'ملخص يومك في السنتر'],
  teachers: ['المدرسون', 'إدارة فريق التدريس'],
  students: ['الطلاب', 'كل بيانات الطلاب المسجلين في السنتر'],
  groups: ['المجموعات', 'نظّم المواد والصفوف ومجموعات المدرسين'],
  attendance: ['الحضور والغياب', 'سجّل حضور كل مجموعة وتابع الغياب'],
  reports: ['التقارير', 'متابعة أداء السنتر خلال الفترات المختلفة'],
  'teacher-detail': ['ملف المدرس', 'المجموعات والطلاب المسجلون'],
  'student-detail': ['ملف الطالب', 'البيانات وسجل الحضور'],
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('markaz-token') || '');
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentProfile, setStudentProfile] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedTeacherGroupId, setSelectedTeacherGroupId] = useState('');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [attendanceGroup, setAttendanceGroup] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayValue());
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('markaz-theme') || 'light');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    localStorage.setItem('markaz-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    request('/auth/me', { token }).then(setUser).catch(() => {
      localStorage.removeItem('markaz-token');
      setToken('');
      setUser(null);
    });
  }, [token]);

  useEffect(() => {
    if (!token || !user) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [dashboardData, groupData] = await Promise.all([
          request('/dashboard', { token }), request('/groups', { token }),
        ]);
        if (cancelled) return;
        setDashboard(dashboardData);
        setGroups(groupData);
        if (page === 'teachers' || page === 'teacher-detail' || (page === 'groups' && user.role === 'admin')) {
          setTeachers(user.role === 'admin' ? await request('/teachers', { token }) : []);
        }
        if (page === 'teacher-detail' && selectedTeacher?.id && selectedTeacherGroupId) {
          const params = new URLSearchParams({ groupId: String(selectedTeacherGroupId) });
          setStudents(await request(`/students?${params.toString()}`, { token }));
        }
        if (page === 'students') {
          const params = new URLSearchParams();
          if (search.trim()) params.set('search', search.trim());
          if (groupFilter) params.set('groupId', groupFilter);
          setStudents(await request(`/students?${params.toString()}`, { token }));
        }
        if (page === 'student-detail' && studentProfile?.id) {
          setStudentProfile(await request(`/students/${studentProfile.id}`, { token }));
        }
        if (page === 'attendance' && attendanceGroup) {
          const attendance = await request(`/groups/${attendanceGroup}/attendance?date=${attendanceDate}`, { token });
          if (!cancelled) {
            setAttendanceStudents(attendance.students);
            setAttendanceMarks(Object.fromEntries(attendance.students.filter((item) => item.status).map((item) => [item.id, item.status])));
          }
        }
      } catch (error) {
        if (!cancelled) notify(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [token, user, page, search, groupFilter, attendanceGroup, attendanceDate, studentProfile?.id, selectedTeacher?.id, selectedTeacherGroupId, refreshKey]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function notify(message) {
    setToast(message);
  }

  function logout() {
    localStorage.removeItem('markaz-token');
    setToken('');
    setUser(null);
    setPage('dashboard');
  }

  function goTo(nextPage) {
    setPage(nextPage);
    setMobileMenu(false);
    setSearch('');
    if (nextPage !== 'students') setGroupFilter('');
  }

  async function handleLogin(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username: event.currentTarget.username.value, password: event.currentTarget.password.value }) });
      localStorage.setItem('markaz-token', result.token);
      setUser(result.user);
      setToken(result.token);
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitModal(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    setSaving(true);
    try {
      if (modal.type === 'teacher') {
        const path = modal.item ? `/teachers/${modal.item.id}` : '/teachers';
        const method = modal.item ? 'PUT' : 'POST';
        await request(path, { token, method, body: JSON.stringify(values) });
      } else if (modal.type === 'student') {
        const path = modal.item ? `/students/${modal.item.id}` : '/students';
        const method = modal.item ? 'PUT' : 'POST';
        const additionalGroupId = values.additionalGroupId;
        delete values.additionalGroupId;
        await request(path, { token, method, body: JSON.stringify(values) });
        if (additionalGroupId) await request(`/students/${modal.item.id}/enrollments`, { token, method: 'POST', body: JSON.stringify({ groupId: additionalGroupId }) });
      } else {
        if (modal.item) {
          const path = `/groups/${modal.item.id}`;
          await request(path, { token, method: 'PUT', body: JSON.stringify(values) });
        } else {
          const names = modal.teacherId
            ? Array.from({ length: Number(values.groupCount || 1) }, (_, index) => values[`groupName_${index}`]?.trim())
            : [values.name?.trim()];
          await request('/groups/bulk', { token, method: 'POST', body: JSON.stringify({ ...values, names }) });
        }
      }
      setModal(null);
      notify(modal.item ? 'تم تحديث البيانات بنجاح' : 'تمت الإضافة بنجاح');
      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(kind, item) {
    const label = kind === 'teacher' ? 'المدرس' : 'الطالب';
    if (!window.confirm(`هل تريد حذف ${label} ${item.name} نهائيًا؟ سيتم حذف المجموعات وسجلات الحضور المرتبطة، ولا يمكن التراجع.`)) return;
    try {
      await request(`/${kind === 'teacher' ? 'teachers' : 'students'}/${item.id}`, { token, method: 'DELETE' });
      notify(`تم حذف ${label} نهائيًا`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify(error.message);
    }
  }

  async function openStudent(id) {
    try {
      const profile = await request(`/students/${id}`, { token });
      setStudentProfile(profile);
      setPage('student-detail');
    } catch (error) {
      notify(error.message);
    }
  }

  async function saveAttendance() {
    if (!attendanceGroup) return notify('اختر المجموعة أولًا');
    setSaving(true);
    try {
      const entries = Object.entries(attendanceMarks).map(([studentId, status]) => ({ studentId: Number(studentId), status }));
      await request(`/groups/${attendanceGroup}/attendance`, { token, method: 'PUT', body: JSON.stringify({ date: attendanceDate, entries }) });
      notify('تم حفظ كشف الحضور');
      setRefreshKey((current) => current + 1);
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!token || !user) return <LoginScreen onSubmit={handleLogin} loading={saving} toast={toast} />;

  const isAdmin = user.role === 'admin';
  const pageMeta = pageTitles[page] || pageTitles.dashboard;
  const visibleNavigation = navigation.filter((item) => isAdmin || !['teachers', 'reports'].includes(item.id));
  const attendanceDone = Object.keys(attendanceMarks).length;
  const attendancePresent = Object.values(attendanceMarks).filter((status) => status === 'present').length;

  return (
    <div className={`app-shell ${theme === 'dark' ? 'dark' : ''}`} dir="rtl">
      {mobileMenu && <button className="mobile-scrim" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>م</span><i /></div>
          <div><strong>مَركز</strong><small>إدارة السنتر التعليمي</small></div>
          <button className="icon-button sidebar-close" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)}><X size={19} /></button>
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
            return <button key={item.id} className={`nav-item ${page === item.id || (item.id === 'teachers' && page === 'teacher-detail') || (item.id === 'students' && page === 'student-detail') ? 'active' : ''}`} onClick={() => goTo(item.id)}>
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
          <button className="icon-button logout-button" aria-label="تسجيل الخروج" title="تسجيل الخروج" onClick={logout}><LogOut size={17} /></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" aria-label="فتح القائمة" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>سنتر النخبة</span><ChevronLeft size={14} /><strong>{pageMeta[0]}</strong></div>
          <div className="topbar-actions">
            <button className="theme-toggle" type="button" aria-label="تبديل الوضع" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
              <span>{theme === 'dark' ? 'فاتح' : 'داكن'}</span>
            </button>
            <span className="today-label"><CalendarDays size={15} />{formatDate(todayValue())}</span>
            <span className="live-indicator"><i /> يعمل الآن</span>
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">{isAdmin ? 'لوحة الإدارة' : 'مساحة المدرس'}</span><h1>{pageMeta[0]}</h1><p>{pageMeta[1]}</p></div>
            <div className="heading-actions">
              {page === 'students' && <button className="button button-primary" onClick={() => setModal({ type: 'student' })}><Plus size={17} />إضافة طالب</button>}
              {page === 'teachers' && <button className="button button-primary" onClick={() => setModal({ type: 'teacher' })}><Plus size={17} />إضافة مدرس</button>}
              {page === 'groups' && isAdmin && <button className="button button-primary" onClick={() => setModal({ type: 'group' })}><Plus size={17} />إضافة مجموعة</button>}
              {page === 'attendance' && <button className="button button-primary" onClick={saveAttendance} disabled={saving || !attendanceGroup}><Check size={17} />{saving ? 'جارٍ الحفظ' : 'حفظ الكشف'}</button>}
            </div>
          </div>

          {loading && <div className="loading-line"><span /> جارٍ تحديث البيانات</div>}
          {page === 'dashboard' && <Dashboard data={dashboard} groups={groups} user={user} onNavigate={goTo} onOpenStudent={openStudent} onAddStudent={() => setModal({ type: 'student' })} />}
          {page === 'teachers' && <TeachersPage teachers={teachers} onAdd={() => setModal({ type: 'teacher' })} onEdit={(teacher) => setModal({ type: 'teacher', item: teacher })} onArchive={(teacher) => deleteItem('teacher', teacher)} onView={(teacher) => { setStudents([]); setSelectedTeacherGroupId(''); setSelectedTeacher(teacher); setPage('teacher-detail'); }} />}
          {page === 'teacher-detail' && <TeacherDetail teacher={selectedTeacher} groups={groups} students={students} selectedGroupId={selectedTeacherGroupId} onChooseGroup={(id) => { setStudents([]); setSelectedTeacherGroupId(String(id)); }} onAddGroup={(grade, gradeLevel) => setModal({ type: 'group', teacherId: selectedTeacher?.id, grade, gradeLevel })} onAddStudent={() => setModal({ type: 'student', teacherId: selectedTeacher?.id, groupId: selectedTeacherGroupId })} onOpenStudent={openStudent} />}
          {page === 'students' && <StudentsPage students={students} groups={groups} search={search} setSearch={setSearch} groupFilter={groupFilter} setGroupFilter={setGroupFilter} isAdmin={isAdmin} onAdd={() => setModal({ type: 'student' })} onEdit={(student) => setModal({ type: 'student', item: student })} onArchive={(student) => deleteItem('student', student)} onOpen={openStudent} />}
          {page === 'student-detail' && <StudentDetail student={studentProfile} onBack={() => goTo('students')} onEdit={(student) => setModal({ type: 'student', item: student })} />}
          {page === 'groups' && <GroupsPage groups={groups} isAdmin={isAdmin} onSelect={(id) => { goTo('students'); setGroupFilter(String(id)); }} onAdd={() => setModal({ type: 'group' })} onEdit={(group) => setModal({ type: 'group', item: group })} />}
          {page === 'attendance' && <AttendancePage groups={groups} groupId={attendanceGroup} setGroupId={setAttendanceGroup} date={attendanceDate} setDate={setAttendanceDate} students={attendanceStudents} marks={attendanceMarks} setMarks={setAttendanceMarks} marked={attendanceDone} present={attendancePresent} />}
          {page === 'reports' && <ReportsPage data={dashboard} />}
        </div>
        <footer className="page-footer"><span>مَركز <i>•</i> نظام إدارة السنتر</span><span>البيانات محفوظة بأمان على هذا الجهاز</span></footer>
      </main>

      {modal && <DataModal modal={modal} groups={modal.teacherId ? groups.filter((group) => group.teacherId === modal.teacherId) : groups} teachers={teachers} user={user} onClose={() => setModal(null)} onSubmit={submitModal} saving={saving} />}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function LoginScreen({ onSubmit, loading, toast }) {
  const [showPassword, setShowPassword] = useState(false);
  return <main className="login-screen" dir="rtl">
    <div className="login-visual">
      <div className="login-visual-top"><div className="brand-mark brand-mark-large"><span>م</span><i /></div><span>نظام إدارة السنتر التعليمي</span></div>
      <div className="login-art" aria-hidden="true">
        <div className="art-board"><div className="art-board-head"><span /><span /><span /></div><div className="art-calendar"><div className="art-calendar-title"><b>جدول الأسبوع</b><i>أكتوبر ٢٠٢٦</i></div><div className="art-grid"><span>س</span><span>ح</span><span>ن</span><span>ث</span><span>ر</span><span>خ</span><span>ج</span><i>١</i><i>٢</i><i>٣</i><i>٤</i><i className="art-highlight">٥</i><i>٦</i><i>٧</i><i>٨</i><i>٩</i><i>١٠</i><i>١١</i><i>١٢</i><i>١٣</i><i>١٤</i></div></div><div className="art-attendance"><div className="art-avatar">أ</div><span><b>أحمد محمد</b><small>حضر الحصة · ٩:١٥ ص</small></span><Check size={15} /></div></div>
        <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
      </div>
      <div className="login-visual-copy"><span className="eyebrow">كل شيء في مكان واحد</span><h2>يوم دراسي<br /><em>أكثر تنظيمًا.</em></h2><p>تابع المدرسين والطلاب والحضور بسهولة، وخلي وقتك للتعليم.</p></div>
      <div className="login-visual-bottom"><span>إدارة تعليمية، ببساطة.</span><span>١ / ٠١</span></div>
    </div>
    <section className="login-form-side">
      <div className="login-form-wrap">
        <div className="login-mobile-brand"><div className="brand-mark"><span>م</span><i /></div><strong>مَركز</strong></div>
        <span className="eyebrow">أهلًا بعودتك</span><h1>تسجيل الدخول</h1><p className="login-subtitle">سجّل دخولك لمتابعة تفاصيل السنتر.</p>
        <form className="login-form" onSubmit={onSubmit}>
          <label htmlFor="username">اسم المستخدم</label><div className="input-wrap"><UserRound size={17} /><input id="username" name="username" autoComplete="username" placeholder="اكتب اسم المستخدم" defaultValue="admin" required /></div>
          <div className="password-label"><label htmlFor="password">كلمة المرور</label><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'إخفاء' : 'إظهار'}</button></div>
          <div className="input-wrap"><ShieldCheck size={17} /><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="اكتب كلمة المرور" defaultValue="markaz123" required /></div>
          <button className="button button-primary login-submit" type="submit" disabled={loading}>{loading ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول'}<ArrowLeft size={17} /></button>
        </form>
        <div className="demo-note"><Sparkles size={15} /><span>للتجربة: المدير <b>admin / markaz123</b></span></div>
        <div className="login-footnote"><span>© ٢٠٢٦ مَركز</span><span><ShieldCheck size={14} /> اتصال آمن</span></div>
      </div>
      {toast && <div className="toast login-toast" role="alert"><XCircle size={17} />{toast}</div>}
    </section>
  </main>;
}

function Dashboard({ data, groups, user, onNavigate, onOpenStudent, onAddStudent }) {
  const firstName = user.name?.split(' ')[0] || 'بك';
  const totalMarked = (data?.present || 0) + (data?.absent || 0);
  const percent = totalMarked ? Math.round(data.present / totalMarked * 100) : 0;
  return <>
    <section className="welcome-band">
      <div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={14} /> الأربعاء، {formatDate(todayValue())}</span><h2>صباح الخير، {firstName} <span>👋</span></h2><p>إليك ملخص متابعة السنتر لهذا اليوم.</p><button className="text-link" onClick={() => onNavigate('attendance')}>افتح كشف الحضور <ArrowLeft size={15} /></button></div>
      <div className="welcome-graphic" aria-hidden="true"><div className="graphic-ring ring-a" /><div className="graphic-ring ring-b" /><div className="graphic-book"><BookOpen size={36} strokeWidth={1.4} /></div><div className="graphic-star star-a">✳</div><div className="graphic-star star-b">✳</div></div>
    </section>
    <section className="metric-grid" aria-label="ملخص الأرقام">
      <MetricCard label="إجمالي الطلاب" value={data?.students ?? '—'} icon={GraduationCap} tone="green" foot="طالب نشط في السنتر" trend="+٨٪" up />
      <MetricCard label="المدرسون" value={data?.teachers ?? '—'} icon={Users} tone="blue" foot="فريق التدريس" trend={`${groups.length} مجموعة`} />
      <MetricCard label="حضور اليوم" value={data?.present ?? '—'} icon={CheckCheck} tone="orange" foot="من الحصص المسجلة اليوم" trend={totalMarked ? `${percent}% من المسجل` : 'لا توجد حصص'} up />
      <MetricCard label="غياب اليوم" value={data?.absent ?? '—'} icon={XCircle} tone="rose" foot="غياب مسجل اليوم" trend={data?.absent ? 'يحتاج متابعة' : 'اليوم هادئ'} />
    </section>
    <div className="dashboard-columns">
      <section className="panel attendance-panel">
        <div className="panel-heading"><div><span className="panel-kicker">متابعة اليوم</span><h3>ملخص الحضور</h3></div><button className="subtle-button" onClick={() => onNavigate('attendance')}>عرض الكشف <ArrowLeft size={15} /></button></div>
        <div className="attendance-summary"><div className="donut-wrap"><div className="donut" style={{ '--progress': `${percent * 3.6}deg` }}><div><b>{percent}<small>%</small></b><span>نسبة الحضور</span></div></div></div><div className="attendance-legend"><div><span className="legend-dot present-dot" /><span>حاضر</span><b>{data?.present ?? 0}</b></div><div><span className="legend-dot absent-dot" /><span>غائب</span><b>{data?.absent ?? 0}</b></div><div><span className="legend-dot pending-dot" /><span>لم يُسجّل</span><b>—</b></div><p>الأعداد محسوبة لكل حصة تم تسجيلها اليوم.</p></div></div>
        <div className="panel-bottom-note"><Clock3 size={15} /><span>آخر تحديث: الآن</span><button onClick={() => onNavigate('attendance')}>تسجيل حضور مجموعة <ArrowLeft size={14} /></button></div>
      </section>
      <section className="panel quick-panel">
        <div className="panel-heading"><div><span className="panel-kicker">اختصارات</span><h3>ابدأ بسرعة</h3></div><MoreHorizontal size={19} className="muted-icon" /></div>
        <div className="quick-actions">
          <button onClick={() => onNavigate('attendance')}><span className="quick-icon quick-orange"><CalendarDays size={18} /></span><span><b>تسجيل الحضور</b><small>اختر مجموعة وابدأ الكشف</small></span><ArrowLeft size={15} /></button>
          <button onClick={onAddStudent}><span className="quick-icon quick-green"><UserRoundPlus size={18} /></span><span><b>إضافة طالب</b><small>تسجيل طالب في مجموعة</small></span><ArrowLeft size={15} /></button>
          <button onClick={() => onNavigate(isAdminUser(user) ? 'teachers' : 'groups')}><span className="quick-icon quick-blue"><Users size={18} /></span><span><b>{isAdminUser(user) ? 'إدارة المدرسين' : 'مجموعاتي'}</b><small>عرض المجموعات والطلاب</small></span><ArrowLeft size={15} /></button>
        </div>
        <div className="quick-footer"><span className="quick-footer-mark"><ShieldCheck size={15} /></span><span><b>بياناتك محفوظة</b><small>كل التغييرات تُحفظ تلقائيًا في قاعدة البيانات</small></span></div>
      </section>
    </div>
    <section className="panel recent-panel">
      <div className="panel-heading"><div><span className="panel-kicker">أحدث الإضافات</span><h3>آخر الطلاب المضافين</h3></div><button className="subtle-button" onClick={() => onNavigate('students')}>كل الطلاب <ArrowLeft size={15} /></button></div>
      {data?.recent?.length ? <div className="table-scroll"><table><thead><tr><th>الطالب</th><th>المدرس</th><th>المادة</th><th>المجموعة</th><th>تاريخ الإضافة</th><th /></tr></thead><tbody>{data.recent.map((student) => <tr key={student.id}><td><button className="person-cell" onClick={() => onOpenStudent(student.id)}><span className="person-avatar">{student.name.slice(0, 1)}</span><span><b>{student.name}</b><small>{student.phone || 'لا يوجد هاتف'}</small></span></button></td><td>{student.teachers || '—'}</td><td>{student.subjects || '—'}</td><td><span className="group-tag">{student.groups || '—'}</span></td><td className="muted-cell">{formatDate(student.createdAt?.slice(0, 10))}</td><td><button className="icon-button row-arrow" aria-label={`عرض ${student.name}`} onClick={() => onOpenStudent(student.id)}><ArrowLeft size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد طلاب بعد" description="أضف أول طالب لبدء تنظيم مجموعاتك." />}
    </section>
  </>;
}

function isAdminUser(user) { return user?.role === 'admin'; }

function MetricCard({ label, value, icon: Icon, tone, foot, trend, up }) {
  return <article className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={19} strokeWidth={1.8} /></div><span className="metric-label">{label}</span><div className="metric-value-row"><b>{value}</b><span className={`metric-trend ${up ? 'trend-up' : ''}`}>{up ? <ArrowUpRight size={13} /> : null}{trend}</span></div><span className="metric-foot">{foot}</span></article>;
}

function TeachersPage({ teachers, onAdd, onEdit, onArchive, onView }) {
  return <section className="panel data-panel">
    <div className="panel-heading table-panel-heading"><div><span className="panel-kicker">فريق السنتر</span><h3>قائمة المدرسين <span className="heading-count">{teachers.length}</span></h3></div><button className="button button-secondary" onClick={onAdd}><Plus size={16} />مدرس جديد</button></div>
    {teachers.length ? <div className="table-scroll"><table><thead><tr><th>المدرس</th><th>المادة والصف</th><th>المجموعات</th><th>الطلاب</th><th>إجراءات</th></tr></thead><tbody>{teachers.map((teacher, index) => <tr key={teacher.id}><td><button className="teacher-card" onClick={() => onView(teacher)}><span className={`teacher-card-photo teacher-avatar avatar-color-${index % 4}`}>{teacher.photo ? <img src={teacher.photo} alt={teacher.name} /> : teacher.name.slice(0, 1)}</span><span className="teacher-card-name">{teacher.name}</span></button></td><td><b className="plain-cell">{teacher.subjects || '—'}</b><small className="cell-subline">{teacher.grades || '—'}</small></td><td>{teacher.groupCount}</td><td><span className="number-pill">{teacher.studentCount}</span></td><td><div className="row-actions"><button className="icon-button" title="عرض المجموعات" onClick={() => onView(teacher)}><ArrowLeft size={16} /></button><button className="icon-button" title="تعديل" onClick={() => onEdit(teacher)}><Settings2 size={16} /></button><button className="icon-button danger-action" title="حذف نهائي" onClick={() => onArchive(teacher)}><X size={16} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد مدرسون" description="أضف المدرس الأول للبدء." action={onAdd} />}
  </section>;
}

function StudentsPage({ students, groups, search, setSearch, groupFilter, setGroupFilter, isAdmin, onAdd, onEdit, onArchive, onOpen }) {
  return <section className="panel data-panel">
    <div className="filter-toolbar"><div className="search-input"><Search size={17} /><input aria-label="ابحث عن طالب" placeholder="ابحث بالاسم أو رقم الهاتف..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div><label className="filter-select"><SlidersHorizontal size={16} /><select aria-label="تصفية حسب المجموعة" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">كل المجموعات</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.subject} · {group.grade}</option>)}</select><ChevronDown size={14} /></label><span className="results-count">{students.length} طالب</span><button className="button button-secondary mobile-add" onClick={onAdd}><Plus size={16} />إضافة</button></div>
    {students.length ? <div className="table-scroll"><table><thead><tr><th>الطالب</th><th>المدرس</th><th>المادة</th><th>الصف</th><th>المجموعة</th><th>رقم ولي الأمر</th><th>إجراءات</th></tr></thead><tbody>{students.map((student, index) => <tr key={student.id}><td><button className="person-cell" onClick={() => onOpen(student.id)}><span className={`person-avatar avatar-color-${index % 4}`}>{student.name.slice(0, 1)}</span><span><b>{student.name}</b><small>{student.phone || 'لا يوجد هاتف'}</small></span></button></td><td>{student.teachers || '—'}</td><td>{student.subjects || '—'}</td><td>{student.grade || '—'}</td><td><span className="group-tag">{student.groups || '—'}</span></td><td>{student.guardianPhone || '—'}</td><td><div className="row-actions"><button className="icon-button" title="سجل الطالب" onClick={() => onOpen(student.id)}><ArrowLeft size={16} /></button><button className="icon-button" title="تعديل" onClick={() => onEdit(student)}><Settings2 size={16} /></button>{isAdmin && <button className="icon-button danger-action" title="حذف نهائي" onClick={() => onArchive(student)}><X size={16} /></button>}</div></td></tr>)}</tbody></table></div> : <EmptyState title="لا توجد نتائج" description={search ? 'جرّب تغيير كلمات البحث أو المجموعة.' : 'أضف طالبًا جديدًا ليظهر هنا.'} action={!search ? onAdd : undefined} />}
    <div className="table-footnote"><span><i className="footnote-dot" />الطلاب النشطون فقط</span><span>يتم عرض {students.length} نتيجة</span></div>
  </section>;
}

function TeacherDetail({ teacher, groups, students, selectedGroupId, onChooseGroup, onAddGroup, onAddStudent, onOpenStudent }) {
  if (!teacher) return <EmptyState title="اختر مدرسًا" description="ارجع إلى قائمة المدرسين لعرض التفاصيل." />;
  const teacherGroups = groups.filter((group) => group.teacherId === teacher.id);
  const selectedGroup = teacherGroups.find((group) => String(group.id) === String(selectedGroupId));
  const grades = [
    { key: 'first', label: 'أولى ثانوي' },
    { key: 'second', label: 'ثانية ثانوي' },
    { key: 'third', label: 'ثالثة ثانوي' },
  ];
  const gradeKey = (value) => {
    const grade = String(value || '').replace(/[أإآ]/g, 'ا');
    if (grade.includes('اول') || grade.includes('اولى') || grade.includes('1') || grade.includes('١')) return 'first';
    if (grade.includes('ثاني') || grade.includes('ثانية') || grade.includes('2') || grade.includes('٢')) return 'second';
    if (grade.includes('ثالث') || grade.includes('ثالثة') || grade.includes('3') || grade.includes('٣')) return 'third';
    return 'other';
  };
  return <>
    <section className="profile-banner teacher-profile-banner">
      <div className="teacher-profile-photo">{teacher.photo ? <img src={teacher.photo} alt={teacher.name} /> : <span>{teacher.name.slice(0, 1)}</span>}</div>
      <div className="profile-banner-copy"><span className="panel-kicker">ملف المدرس</span><h2>{teacher.name}</h2><p>{teacher.subjects || 'المواد غير محددة'} <span>·</span> {teacher.phone || 'لا يوجد رقم هاتف'}</p></div>
      <div className="profile-stat"><b>{selectedGroup ? selectedGroup.studentCount : teacher.studentCount}</b><span>{selectedGroup ? 'طالبًا في هذه المجموعة' : 'طالبًا مسجلًا'}</span></div>
      <div className="profile-stat"><b>{teacherGroups.length}</b><span>مجموعات</span></div>
      {selectedGroup && <button className="button button-primary teacher-add-student" onClick={onAddStudent}><Plus size={17} />إضافة طالب للمجموعة</button>}
    </section>
    <section className="teacher-grade-section"><div className="panel-heading"><div><span className="panel-kicker">تقسيم المجموعات</span><h3>مجموعات {teacher.name.split(' ')[0]}</h3></div><span className="number-pill">{teacherGroups.length} مجموعة</span></div><div className="teacher-grade-grid">{grades.map((grade) => { const gradeGroups = teacherGroups.filter((group) => (group.gradeLevel || gradeKey(group.grade)) === grade.key); return <article className="teacher-grade-box" key={grade.key}><header className="teacher-grade-heading"><div><span className="panel-kicker">الصف الدراسي</span><h4>{grade.label}</h4></div><button className="button button-secondary" onClick={() => onAddGroup(grade.label, grade.key)}><Plus size={15} />إضافة مجموعة</button></header><div className="teacher-grade-list">{gradeGroups.map((group) => <button className={`teacher-group-card ${String(group.id) === String(selectedGroupId) ? 'selected' : ''}`} aria-pressed={String(group.id) === String(selectedGroupId)} key={group.id} onClick={() => onChooseGroup(group.id)}><span className="group-card-icon"><BookOpen size={18} /></span><span><b>{group.subject}</b><small>{group.grade} · {group.schedule || 'ميعاد غير محدد'}</small></span><span className="group-card-count"><Users size={14} />{group.studentCount}</span><ArrowLeft size={15} /></button>)}{!gradeGroups.length && <p className="teacher-grade-empty">لا توجد مجموعات لهذا الصف</p>}</div></article>; })}</div>{teacherGroups.some((group) => (group.gradeLevel || gradeKey(group.grade)) === 'other') && <div className="teacher-grade-unassigned"><span className="panel-kicker">صفوف أخرى</span>{teacherGroups.filter((group) => (group.gradeLevel || gradeKey(group.grade)) === 'other').map((group) => <button className={`teacher-group-card ${String(group.id) === String(selectedGroupId) ? 'selected' : ''}`} aria-pressed={String(group.id) === String(selectedGroupId)} key={group.id} onClick={() => onChooseGroup(group.id)}><span className="group-card-icon"><BookOpen size={18} /></span><span><b>{group.subject}</b><small>{group.grade} · {group.schedule || 'ميعاد غير محدد'}</small></span><span className="group-card-count"><Users size={14} />{group.studentCount}</span><ArrowLeft size={15} /></button>)}</div>}</section>
    {selectedGroup ? <section className="panel teacher-students-panel">
      <div className="panel-heading"><div><span className="panel-kicker">طلاب المجموعة</span><h3>{selectedGroup.subject} <span className="heading-count">{students.length}</span></h3></div><button className="button button-secondary" onClick={onAddStudent}><Plus size={16} />إضافة طالب</button></div>
      {students.length ? <div className="table-scroll"><table><thead><tr><th>الطالب</th><th>رقم الهاتف</th><th>المادة</th><th>الصف</th><th>المجموعة</th><th /></tr></thead><tbody>{students.map((student, index) => <tr key={student.id}><td><button className="person-cell" onClick={() => onOpenStudent(student.id)}><span className={`person-avatar avatar-color-${index % 4}`}>{student.name.slice(0, 1)}</span><span><b>{student.name}</b><small>{student.guardianPhone || 'لا يوجد رقم ولي أمر'}</small></span></button></td><td>{student.phone || '—'}</td><td>{student.subjects || '—'}</td><td>{student.grade || '—'}</td><td><span className="group-tag">{student.groups || '—'}</span></td><td><button className="icon-button row-arrow" aria-label={`عرض ${student.name}`} onClick={() => onOpenStudent(student.id)}><ArrowLeft size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد طلاب في هذه المجموعة" description="أضف طالبًا للمجموعة لعرضه هنا." action={onAddStudent} />}
    </section> : <section className="panel teacher-roster-prompt"><span className="group-card-icon"><BookOpen size={20} /></span><h3>اختار مجموعة لعرض طلابها</h3><p>اضغط على إحدى مجموعات المدرس لفتح قائمة طلابها.</p></section>}
  </>;
}

function GroupsPage({ groups, isAdmin, onSelect, onAdd, onEdit }) {
  return <section className="group-card-grid">{groups.map((group, index) => <article className="group-card" key={group.id}><button className="group-card-main" onClick={() => onSelect(group.id)}><span className={`group-card-top group-tone-${index % 3}`}><BookOpen size={20} /><span>{group.subject}</span></span><span className="group-card-subject">{group.grade}</span><span className="group-card-grade">{group.schedule ? `ميعاد ${group.schedule}` : 'ميعاد غير محدد'}</span><span className="group-card-footer"><span className="mini-teacher-avatar">{group.teacherName?.slice(0, 1)}</span><span>{group.teacherName}</span><span className="group-card-count"><Users size={15} />{group.studentCount}</span><ArrowLeft size={15} /></span></button>{isAdmin && <button className="icon-button group-card-edit" title="تعديل المجموعة" aria-label={`تعديل مجموعة ${group.subject}`} onClick={() => onEdit(group)}><Settings2 size={16} /></button>}</article>)}{isAdmin && <button className="new-group-card" onClick={onAdd}><span><Plus size={19} /></span><b>إنشاء مجموعة جديدة</b><small>اربط المادة بالمدرس والصف</small></button>}{!groups.length && <EmptyState title="لا توجد مجموعات" description={isAdmin ? 'أنشئ مجموعة جديدة للبدء.' : 'لم يتم ربط مجموعات بحسابك بعد.'} />}</section>;
}

function AttendancePage({ groups, groupId, setGroupId, date, setDate, students, marks, setMarks, marked, present }) {
  const selectedGroup = groups.find((group) => String(group.id) === String(groupId));
  function setAll(status) {
    setMarks(Object.fromEntries(students.map((student) => [student.id, status])));
  }
  return <>
    <section className="attendance-toolbar panel"><div className="attendance-select-wrap"><label htmlFor="attendance-group">المجموعة</label><div className="select-control"><BookOpen size={17} /><select id="attendance-group" value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">اختر المجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.subject} · {group.grade}{group.schedule ? ` · ${group.schedule}` : ''}</option>)}</select><ChevronDown size={15} /></div></div><div className="attendance-date-wrap"><label htmlFor="attendance-date">تاريخ الحصة</label><div className="date-control"><CalendarDays size={17} /><input id="attendance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div></div>{selectedGroup && <div className="attendance-group-meta"><span>{selectedGroup.teacherName}</span><b>{selectedGroup.studentCount} طالب</b></div>}</section>
    {!groupId ? <div className="panel attendance-empty"><div className="attendance-empty-icon"><CalendarDays size={22} /></div><h3>اختر مجموعة لبدء الكشف</h3><p>ستظهر قائمة الطلاب المسجلين في المجموعة هنا.</p></div> : <section className="panel attendance-sheet">
      <div className="attendance-sheet-head"><div><span className="panel-kicker">كشف المجموعة</span><h3>{selectedGroup?.subject} <span>·</span> {selectedGroup?.grade}</h3><p>{formatDate(date)} <span>·</span> {students.length} طالب</p></div><div className="mark-all-actions"><span>تحديد الكل:</span><button className="mark-all-present" onClick={() => setAll('present')}><Check size={15} />حاضر</button><button className="mark-all-absent" onClick={() => setAll('absent')}><X size={15} />غائب</button></div></div>
      <div className="attendance-progress"><span style={{ width: `${students.length ? marked / students.length * 100 : 0}%` }} /></div>
      {students.length ? <div className="attendance-list">{students.map((student, index) => <div className="attendance-row" key={student.id}><span className="attendance-index">{String(index + 1).padStart(2, '0')}</span><span className={`person-avatar avatar-color-${index % 4}`}>{student.name.slice(0, 1)}</span><span className="attendance-person"><b>{student.name}</b><small>{student.phone || 'لا يوجد رقم هاتف'}</small></span><span className={`attendance-state ${marks[student.id] ? `state-${marks[student.id]}` : 'state-unmarked'}`}>{marks[student.id] === 'present' ? 'حاضر' : marks[student.id] === 'absent' ? 'غائب' : 'لم يُسجّل'}</span><div className="attendance-actions"><button className={`attendance-toggle present-toggle ${marks[student.id] === 'present' ? 'selected' : ''}`} aria-label={`تحديد ${student.name} حاضر`} onClick={() => setMarks({ ...marks, [student.id]: 'present' })}><Check size={17} /></button><button className={`attendance-toggle absent-toggle ${marks[student.id] === 'absent' ? 'selected' : ''}`} aria-label={`تحديد ${student.name} غائب`} onClick={() => setMarks({ ...marks, [student.id]: 'absent' })}><X size={17} /></button></div></div>)}</div> : <EmptyState title="لا يوجد طلاب في هذه المجموعة" description="أضف الطلاب للمجموعة أولًا من صفحة الطلاب." />}
      <div className="attendance-sheet-footer"><span><span className="legend-dot present-dot" />حاضر <b>{present}</b></span><span><span className="legend-dot absent-dot" />غائب <b>{Object.values(marks).filter((mark) => mark === 'absent').length}</b></span><span className="sheet-unsaved">تم تحديد {marked} من {students.length}</span></div>
    </section>}
  </>;
}

function StudentDetail({ student, onBack, onEdit }) {
  if (!student) return <EmptyState title="لم يتم اختيار طالب" description="ارجع إلى قائمة الطلاب لفتح ملف الطالب." />;
  const history = student.attendance || [];
  return <>
    <button className="back-link" onClick={onBack}><ArrowLeft size={15} />العودة لقائمة الطلاب</button>
    <section className="profile-banner student-profile-banner"><div className="large-profile-avatar student-large-avatar">{student.name.slice(0, 1)}</div><div className="profile-banner-copy"><span className="panel-kicker">ملف الطالب</span><h2>{student.name}</h2><p>{student.phone || 'لا يوجد هاتف'} <span>·</span> الصف {student.grade || 'غير محدد'}</p></div><div className="profile-stat"><b>{student.attendanceRate == null ? '—' : `${student.attendanceRate}%`}</b><span>نسبة الحضور</span></div><button className="button button-secondary profile-edit-button" onClick={() => onEdit(student)}><Settings2 size={16} />تعديل البيانات</button></section>
    <div className="student-detail-grid"><section className="panel student-info-panel"><div className="panel-heading"><div><span className="panel-kicker">البيانات الأساسية</span><h3>معلومات الطالب</h3></div></div><div className="info-grid"><InfoItem label="رقم الهاتف" value={student.phone} /><InfoItem label="رقم ولي الأمر" value={student.guardianPhone} /><InfoItem label="الصف الدراسي" value={student.grade} /><InfoItem label="الملاحظات" value={student.notes} /></div><div className="student-enrollments"><b>المجموعات المسجل بها</b><div>{student.groups?.map((group) => <span className="group-tag" key={group.id}>{group.subject} · {group.grade}</span>)}</div></div></section>
      <section className="panel history-panel"><div className="panel-heading"><div><span className="panel-kicker">سجل الطالب</span><h3>تاريخ الحضور</h3></div><span className="number-pill">{history.length} حصة</span></div>{history.length ? <div className="history-list">{history.map((entry, index) => <div className="history-row" key={`${entry.date}-${entry.groupName}-${index}`}><span className={`history-status ${entry.status}`}><i />{entry.status === 'present' ? 'حاضر' : 'غائب'}</span><b>{formatDate(entry.date)}</b><span>{entry.subject} · {entry.groupName}</span></div>)}</div> : <EmptyState title="لا يوجد سجل حضور" description="سيظهر السجل بعد تسجيل حضور الطالب." />}</section></div>
  </>;
}

function InfoItem({ label, value }) { return <div className="info-item"><span>{label}</span><b>{value || '—'}</b></div>; }

function ReportsPage({ data }) {
  return <section className="reports-coming panel"><div className="report-icon"><Activity size={24} /></div><span className="eyebrow">قريبًا · المرحلة الثانية</span><h2>الصورة الكاملة، في تقرير واحد.</h2><p>التقارير التفصيلية حسب المدرس والمادة والمجموعة والفترة الزمنية ستكون متاحة في المرحلة التالية.</p><div className="report-preview"><span><b>{data?.present ?? 0}</b><small>حضور اليوم</small></span><span><b>{data?.absent ?? 0}</b><small>غياب اليوم</small></span><span><b>{data?.students ?? 0}</b><small>طلاب نشطون</small></span></div></section>;
}

function DataModal({ modal, groups, teachers, user, onClose, onSubmit, saving }) {
  const { type, item } = modal;
  const [photo, setPhoto] = useState(item?.photo || '');
  const [photoError, setPhotoError] = useState('');
  const [groupCount, setGroupCount] = useState(1);
  const [groupNames, setGroupNames] = useState([item?.name || 'مجموعة 1']);
  const isStudent = type === 'student';
  const isTeacher = type === 'teacher';
  const groupTeacher = teachers.find((teacher) => teacher.id === modal.teacherId);
  const title = isTeacher ? (item ? 'تعديل بيانات المدرس' : 'إضافة مدرس جديد') : isStudent ? (item ? 'تعديل بيانات الطالب' : modal.groupId ? 'إضافة طالب للمجموعة' : 'إضافة طالب جديد') : item ? 'تعديل بيانات المجموعة' : modal.teacherId ? 'إضافة مجموعة للمدرس' : 'إنشاء مجموعة جديدة';
  const groupIds = String(item?.groupIds || item?.groups?.map((group) => group.id).join(',') || '').split(',');
  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1.5 * 1024 * 1024) {
      setPhotoError('اختر صورة JPG أو PNG أو WEBP لا يزيد حجمها عن 1.5 ميجابايت.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result || ''));
      setPhotoError('');
    };
    reader.onerror = () => setPhotoError('تعذر قراءة الصورة، جرّب ملفًا آخر.');
    reader.readAsDataURL(file);
  }
  function handleGroupCountChange(event) {
    const count = Math.max(1, Math.min(20, Number(event.target.value) || 1));
    setGroupCount(count);
    setGroupNames((current) => Array.from({ length: count }, (_, index) => current[index] || `مجموعة ${index + 1}`));
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="panel-kicker">{isTeacher ? 'فريق التدريس' : isStudent ? 'ملف الطالب' : 'تنظيم السنتر'}</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="إغلاق" onClick={onClose}><X size={19} /></button></div><form onSubmit={onSubmit}>
    {isTeacher && <><input type="hidden" name="photo" value={photo} readOnly /><div className="teacher-photo-upload"><div className="teacher-photo-preview">{photo ? <img src={photo} alt="معاينة صورة المدرس" /> : <UserRound size={24} />}</div><div className="teacher-photo-control"><label className="form-field"><span>صورة المدرس</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} /></label><small>JPG أو PNG أو WEBP، بحد أقصى 1.5 ميجابايت</small>{photoError && <small className="photo-error">{photoError}</small>}</div>{photo && <button className="button button-quiet" type="button" onClick={() => setPhoto('')}>إزالة الصورة</button>}</div><div className="form-grid"><Field label="اسم المدرس" name="name" defaultValue={item?.name} placeholder="مثال: أحمد محمد" required /><Field label="رقم الهاتف" name="phone" defaultValue={item?.phone} placeholder="01xxxxxxxxx" /><Field label="المادة" name="subject" defaultValue={item?.subjects?.split(', ')[0]} placeholder="مثال: رياضيات" required disabled={Boolean(item)} /></div></>}
    {isStudent && <><div className="form-grid">{!item && modal.groupId && <input type="hidden" name="groupId" value={modal.groupId} readOnly />}<Field label="اسم الطالب" name="name" defaultValue={item?.name} placeholder="مثال: محمد أحمد" required /><Field label="رقم الهاتف" name="phone" defaultValue={item?.phone} placeholder="01xxxxxxxxx" /><Field label="رقم ولي الأمر" name="guardianPhone" defaultValue={item?.guardianPhone} placeholder="01xxxxxxxxx" />{!item && !modal.groupId && <><label className="form-field"><span>المجموعة</span><select name="groupId" required defaultValue={user.role === 'teacher' ? groups[0]?.id : ''}><option value="" disabled>اختر المجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.subject} · {group.grade}</option>)}</select></label></>}{item && <><label className="form-field"><span>إضافة إلى مجموعة أخرى</span><select name="additionalGroupId" defaultValue=""><option value="">بدون تغيير</option>{groups.filter((group) => !groupIds.includes(String(group.id))).map((group) => <option key={group.id} value={group.id}>{group.subject} · {group.grade}</option>)}</select></label><label className="form-field full-field"><span>ملاحظات</span><textarea name="notes" defaultValue={item?.notes} rows="3" placeholder="أي معلومات إضافية عن الطالب" /></label></>}</div>{item && <p className="form-hint">يمكنك إضافة الطالب إلى مجموعة أخرى دون حذف تسجيلاته السابقة.</p>}</>}
    {!isTeacher && !isStudent && <div className="form-grid">{modal.teacherId && !item ? <><input type="hidden" name="teacherId" value={modal.teacherId} readOnly /><input type="hidden" name="subject" value={groupTeacher?.subjects?.split(', ')[0] || ''} readOnly /><input type="hidden" name="gradeLevel" value={modal.gradeLevel} readOnly /><label className="form-field"><span>عدد المجموعات</span><input name="groupCount" type="number" min="1" max="20" value={groupCount} onChange={handleGroupCountChange} /></label>{groupNames.map((name, index) => <label className="form-field" key={index}><span>اسم المجموعة {index + 1}</span><input name={`groupName_${index}`} value={name} onChange={(event) => setGroupNames((current) => current.map((currentName, currentIndex) => currentIndex === index ? event.target.value : currentName))} required /></label>)}</> : <>{!modal.teacherId && <label className="form-field full-field"><span>المدرس</span><select name="teacherId" required defaultValue={item?.teacherId || ''}><option value="" disabled>اختر المدرس</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}{item?.gradeLevel && <input type="hidden" name="gradeLevel" value={item.gradeLevel} readOnly />}<Field label="اسم المجموعة" name="name" defaultValue={item?.name || 'مجموعة A'} required /><Field label="المادة" name="subject" defaultValue={item?.subject || groupTeacher?.subjects?.split(', ')[0]} placeholder="مثال: رياضيات" required /></>}<Field label="ميعاد المجموعة" name="schedule" defaultValue={item?.schedule} type="time" required /></div>}
    <div className="modal-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ…' : item ? 'حفظ التعديلات' : isTeacher ? 'إضافة المدرس' : isStudent ? 'إضافة الطالب' : modal.teacherId ? 'إنشاء المجموعات' : 'إنشاء المجموعة'}</button><button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button></div>
  </form></section></div>;
}

function Field({ label, name, defaultValue, placeholder, required, type = 'text', minLength, disabled }) {
  return <label className="form-field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue || ''} placeholder={placeholder} required={required} minLength={minLength} disabled={disabled} /></label>;
}

function EmptyState({ title, description, action }) {
  return <div className="empty-state"><div className="empty-icon"><BookOpen size={19} /></div><h3>{title}</h3><p>{description}</p>{action && <button className="button button-secondary" onClick={action}><Plus size={16} />إضافة الآن</button>}</div>;
}

export default App;