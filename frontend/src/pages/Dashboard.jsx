import { ArrowLeft, BookOpen, CalendarDays, CheckCheck, Clock3, GraduationCap, MoreHorizontal, ShieldCheck, Sparkles, Users, UserRoundPlus, XCircle } from 'lucide-react';
import { formatDate, todayValue, isAdminUser } from '../utils/helpers.js';
import { MetricCard } from '../components/MetricCard.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function Dashboard({ data, groups, user, onNavigate, onOpenStudent, onAddStudent }) {
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
