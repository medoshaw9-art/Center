import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { request } from './services/api.js';
import { todayValue } from './utils/helpers.js';
import { DataModal } from './components/DataModal.jsx';
import { StudentImportModal } from './components/StudentImportModal.jsx';
import { Navbar } from './components/Navbar.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { LoginScreen } from './pages/Login.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { TeachersPage, TeacherDetail } from './pages/Teachers.jsx';
import { StudentsPage, StudentDetail } from './pages/Students.jsx';
import { GroupsPage } from './pages/Groups.jsx';
import { AttendancePage } from './pages/Attendance.jsx';
import { ReportsPage } from './pages/Reports.jsx';
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
  const [attendanceTeacherId, setAttendanceTeacherId] = useState('');
  const [attendanceGroup, setAttendanceGroup] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayValue());
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [attendanceMarks, setAttendanceMarks] = useState({});
  const [modal, setModal] = useState(null);
  const [studentImportOpen, setStudentImportOpen] = useState(false);
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

  function chooseAttendanceTeacher(teacherId) {
    setAttendanceTeacherId(teacherId);
    setAttendanceGroup('');
    setAttendanceStudents([]);
    setAttendanceMarks({});
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
  const attendanceDone = Object.keys(attendanceMarks).length;
  const attendancePresent = Object.values(attendanceMarks).filter((status) => status === 'present').length;

  return (
    <div className={`app-shell ${theme === 'dark' ? 'dark' : ''}`} dir="rtl">
      <Sidebar
        mobileMenu={mobileMenu}
        onClose={() => setMobileMenu(false)}
        user={user}
        isAdmin={isAdmin}
        page={page}
        dashboard={dashboard}
        onNavigate={goTo}
        onLogout={logout}
      />

      <main className="main-area">
        <Navbar
          pageTitle={pageMeta[0]}
          onOpenMenu={() => setMobileMenu(true)}
          theme={theme}
          onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
        />

        <div className="page-content">
          <div className="page-heading">
            <div><span className="eyebrow">{isAdmin ? 'لوحة الإدارة' : 'مساحة المدرس'}</span><h1>{pageMeta[0]}</h1><p>{pageMeta[1]}</p></div>
            <div className="heading-actions">
              {page === 'students' && <button className="button button-primary" onClick={() => setModal({ type: 'student' })}><Plus size={17} />إضافة طالب</button>}
              {page === 'students' && isAdmin && <button className="button button-secondary" onClick={() => setStudentImportOpen(true)}>استيراد طلاب</button>}
              {page === 'teachers' && <button className="button button-primary" onClick={() => setModal({ type: 'teacher' })}><Plus size={17} />إضافة مدرس</button>}
              {page === 'groups' && isAdmin && <button className="button button-primary" onClick={() => setModal({ type: 'group' })}><Plus size={17} />إضافة مجموعة</button>}
              {page === 'attendance' && <button className="button button-primary" onClick={saveAttendance} disabled={saving || !attendanceGroup}><Check size={17} />{saving ? 'جارٍ الحفظ' : 'حفظ الكشف'}</button>}
            </div>
          </div>

          {loading && <div className="loading-line"><span /> جارٍ تحديث البيانات</div>}
          {page === 'dashboard' && <Dashboard data={dashboard} groups={groups} user={user} onNavigate={goTo} onOpenStudent={openStudent} onAddStudent={() => setModal({ type: 'student' })} />}
          {page === 'teachers' && <TeachersPage teachers={teachers} onAdd={() => setModal({ type: 'teacher' })} onEdit={(teacher) => setModal({ type: 'teacher', item: teacher })} onArchive={(teacher) => deleteItem('teacher', teacher)} onView={(teacher) => { setStudents([]); setSelectedTeacherGroupId(''); setSelectedTeacher(teacher); setPage('teacher-detail'); }} />}
          {page === 'teacher-detail' && <TeacherDetail teacher={selectedTeacher} groups={groups} students={students} selectedGroupId={selectedTeacherGroupId} onChooseGroup={(id) => { setStudents([]); setSelectedTeacherGroupId(String(id)); }} onAddGroup={(grade, gradeLevel) => setModal({ type: 'group', teacherId: selectedTeacher?.id, grade, gradeLevel })} onAddStudent={() => setModal({ type: 'student', teacherId: selectedTeacher?.id, groupId: selectedTeacherGroupId })} onImportStudents={() => setStudentImportOpen(true)} onOpenStudent={openStudent} />}
          {page === 'students' && <StudentsPage students={students} groups={groups} search={search} setSearch={setSearch} groupFilter={groupFilter} setGroupFilter={setGroupFilter} isAdmin={isAdmin} onAdd={() => setModal({ type: 'student' })} onEdit={(student) => setModal({ type: 'student', item: student })} onArchive={(student) => deleteItem('student', student)} onOpen={openStudent} />}
          {page === 'student-detail' && <StudentDetail student={studentProfile} onBack={() => goTo('students')} onEdit={(student) => setModal({ type: 'student', item: student })} />}
          {page === 'groups' && <GroupsPage groups={groups} isAdmin={isAdmin} onSelect={(id) => { goTo('students'); setGroupFilter(String(id)); }} onAdd={() => setModal({ type: 'group' })} onEdit={(group) => setModal({ type: 'group', item: group })} />}
          {page === 'attendance' && <AttendancePage groups={groups} teacherId={attendanceTeacherId} setTeacherId={chooseAttendanceTeacher} groupId={attendanceGroup} setGroupId={setAttendanceGroup} date={attendanceDate} setDate={setAttendanceDate} students={attendanceStudents} marks={attendanceMarks} setMarks={setAttendanceMarks} marked={attendanceDone} present={attendancePresent} />}
          {page === 'reports' && <ReportsPage data={dashboard} />}
        </div>
        <footer className="page-footer"><span>مَركز <i>•</i> نظام إدارة السنتر</span><span>البيانات محفوظة بأمان على هذا الجهاز</span></footer>
      </main>

      {modal && <DataModal modal={modal} groups={modal.teacherId ? groups.filter((group) => group.teacherId === modal.teacherId) : groups} teachers={teachers} user={user} onClose={() => setModal(null)} onSubmit={submitModal} saving={saving} />}
      {studentImportOpen && <StudentImportModal
        groups={page === 'teacher-detail' && selectedTeacher
          ? groups.filter((group) => String(group.teacherId) === String(selectedTeacher.id))
          : groups}
        initialGroupId={page === 'teacher-detail' ? selectedTeacherGroupId : ''}
        teacherName={page === 'teacher-detail' ? selectedTeacher?.name : ''}
        token={token}
        onClose={() => setStudentImportOpen(false)}
        onImported={() => setRefreshKey((current) => current + 1)}
      />}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}































export default App;