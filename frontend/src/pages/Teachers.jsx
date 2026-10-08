import { ArrowLeft, BookOpen, Plus, Settings2, Users, X } from 'lucide-react';
import { EmptyState } from '../components/EmptyState.jsx';

export function TeachersPage({ teachers, onAdd, onEdit, onArchive, onView }) {
  return <section className="panel data-panel">
    <div className="panel-heading table-panel-heading"><div><span className="panel-kicker">فريق السنتر</span><h3>قائمة المدرسين <span className="heading-count">{teachers.length}</span></h3></div><button className="button button-secondary" onClick={onAdd}><Plus size={16} />مدرس جديد</button></div>
    {teachers.length ? <div className="table-scroll"><table><thead><tr><th>المدرس</th><th>المادة والصف</th><th>المجموعات</th><th>الطلاب</th><th>إجراءات</th></tr></thead><tbody>{teachers.map((teacher, index) => <tr key={teacher.id}><td><button className="teacher-card" onClick={() => onView(teacher)}><span className={`teacher-card-photo teacher-avatar avatar-color-${index % 4}`}>{teacher.photo ? <img src={teacher.photo} alt={teacher.name} /> : teacher.name.slice(0, 1)}</span><span className="teacher-card-name">{teacher.name}</span></button></td><td><b className="plain-cell">{teacher.subjects || '—'}</b><small className="cell-subline">{teacher.grades || '—'}</small></td><td>{teacher.groupCount}</td><td><span className="number-pill">{teacher.studentCount}</span></td><td><div className="row-actions"><button className="icon-button" title="عرض المجموعات" onClick={() => onView(teacher)}><ArrowLeft size={16} /></button><button className="icon-button" title="تعديل" onClick={() => onEdit(teacher)}><Settings2 size={16} /></button><button className="icon-button danger-action" title="حذف نهائي" onClick={() => onArchive(teacher)}><X size={16} /></button></div></td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد مدرسون" description="أضف المدرس الأول للبدء." action={onAdd} />}
  </section>;
}

export function TeacherDetail({ teacher, groups, students, selectedGroupId, onChooseGroup, onAddGroup, onAddStudent, onImportStudents, onOpenStudent }) {
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
      <div className="panel-heading"><div><span className="panel-kicker">طلاب المجموعة</span><h3>{selectedGroup.subject} <span className="heading-count">{students.length}</span></h3></div><div className="heading-actions"><button className="button button-secondary" onClick={onImportStudents}><Users size={16} />استيراد طلاب</button><button className="button button-secondary" onClick={onAddStudent}><Plus size={16} />إضافة طالب</button></div></div>
      {students.length ? <div className="table-scroll"><table><thead><tr><th>الطالب</th><th>رقم الهاتف</th><th>المادة</th><th>الصف</th><th>المجموعة</th><th /></tr></thead><tbody>{students.map((student, index) => <tr key={student.id}><td><button className="person-cell" onClick={() => onOpenStudent(student.id)}><span className={`person-avatar avatar-color-${index % 4}`}>{student.name.slice(0, 1)}</span><span><b>{student.name}</b><small>{student.guardianPhone || 'لا يوجد رقم ولي أمر'}</small></span></button></td><td>{student.phone || '—'}</td><td>{student.subjects || '—'}</td><td>{student.grade || '—'}</td><td><span className="group-tag">{student.groups || '—'}</span></td><td><button className="icon-button row-arrow" aria-label={`عرض ${student.name}`} onClick={() => onOpenStudent(student.id)}><ArrowLeft size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState title="لا يوجد طلاب في هذه المجموعة" description="أضف طالبًا للمجموعة لعرضه هنا." action={onAddStudent} />}
    </section> : <section className="panel teacher-roster-prompt"><span className="group-card-icon"><BookOpen size={20} /></span><h3>اختار مجموعة لعرض طلابها</h3><p>اضغط على إحدى مجموعات المدرس لفتح قائمة طلابها.</p></section>}
  </>;
}
