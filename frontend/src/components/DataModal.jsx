import { useState } from 'react';
import { UserRound, X } from 'lucide-react';

export function DataModal({ modal, groups, teachers, user, onClose, onSubmit, saving }) {
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
    {!isTeacher && !isStudent && <div className="form-grid">{modal.teacherId && !item ? <><input type="hidden" name="teacherId" value={modal.teacherId} readOnly /><input type="hidden" name="subject" value={groupTeacher?.subjects?.split(', ')[0] || ''} readOnly /><input type="hidden" name="gradeLevel" value={modal.gradeLevel} readOnly />{modal.grade && <Field label="الصف الدراسي" name="grade" defaultValue={modal.grade} placeholder="مثال: الصف الرابع" required />}<label className="form-field"><span>عدد المجموعات</span><input name="groupCount" type="number" min="1" max="20" value={groupCount} onChange={handleGroupCountChange} /></label>{groupNames.map((name, index) => <label className="form-field" key={index}><span>اسم المجموعة {index + 1}</span><input name={`groupName_${index}`} value={name} onChange={(event) => setGroupNames((current) => current.map((currentName, currentIndex) => currentIndex === index ? event.target.value : currentName))} required /></label>)}</> : <>{!modal.teacherId && <label className="form-field full-field"><span>المدرس</span><select name="teacherId" required defaultValue={item?.teacherId || ''}><option value="" disabled>اختر المدرس</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>}{item?.gradeLevel && <input type="hidden" name="gradeLevel" value={item.gradeLevel} readOnly />}<Field label="اسم المجموعة" name="name" defaultValue={item?.name || 'مجموعة A'} required /><Field label="المادة" name="subject" defaultValue={item?.subject || groupTeacher?.subjects?.split(', ')[0]} placeholder="مثال: رياضيات" required />{(modal.grade || item?.grade) && <Field label="الصف الدراسي" name="grade" defaultValue={item?.grade || modal.grade} placeholder="مثال: الصف الرابع" required />}</>}{item ? <Field label="ميعاد المجموعة" name="schedule" defaultValue={item?.schedule} type="time" required /> : <Field label="ميعاد المجموعة" name="schedule" defaultValue={''} type="time" required />}</div>}
    <div className="modal-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ…' : item ? 'حفظ التعديلات' : isTeacher ? 'إضافة المدرس' : isStudent ? 'إضافة الطالب' : modal.teacherId ? 'إنشاء المجموعات' : 'إنشاء المجموعة'}</button><button className="button button-quiet" type="button" onClick={onClose}>إلغاء</button></div>
  </form></section></div>;
}

export function Field({ label, name, defaultValue, placeholder, required, type = 'text', minLength, disabled }) {
  return <label className="form-field"><span>{label}</span><input name={name} type={type} defaultValue={defaultValue || ''} placeholder={placeholder} required={required} minLength={minLength} disabled={disabled} /></label>;
}
