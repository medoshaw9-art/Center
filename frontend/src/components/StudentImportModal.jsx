import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react';
import { request } from '../services/api.js';
import { parseStudentWorkbook } from '../utils/studentWorkbook.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_STUDENTS = 500;

export function StudentImportModal({ groups, initialGroupId = '', teacherName = '', token, onClose, onImported }) {
  const inputRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [blankRows, setBlankRows] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(String(initialGroupId));
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState('');
  const [result, setResult] = useState(null);
  const [requestError, setRequestError] = useState('');

  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.filter((row) => row.errors.length > 0);
  const exceedsLimit = rows.length > MAX_STUDENTS;
  const canImport =
    Boolean(fileName) &&
    Boolean(selectedGroupId) &&
    validRows.length > 0 &&
    !exceedsLimit &&
    !result &&
    !reading &&
    !importing;

  async function readFile(event) {
    const file = event.target.files?.[0];
    setRows([]);
    setBlankRows([]);
    setFileError('');
    setRequestError('');
    setResult(null);
    setFileName('');
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    if (!['xlsx', 'xls'].includes(extension)) {
      setFileError('اختر ملف Excel بامتداد .xlsx أو .xls.');
      event.target.value = '';
      return;
    }
    if (file.size === 0) {
      setFileError('الملف فارغ.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('حجم الملف أكبر من الحد المسموح (10 ميجابايت).');
      event.target.value = '';
      return;
    }

    setReading(true);
    setFileName(file.name);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        cellNF: true,
        cellText: true,
      });
      const parsed = parseStudentWorkbook(XLSX, workbook);
      if (!parsed.rows.length) {
        setFileError('لا توجد صفوف طلاب بعد صف العناوين.');
        setFileName('');
        return;
      }
      setRows(parsed.rows);
      setBlankRows(parsed.blankRows);
    } catch (error) {
      setFileError(error.message || 'تعذر قراءة الملف. تحقق من سلامة ملف Excel.');
      setFileName('');
    } finally {
      setReading(false);
    }
  }

  async function confirmImport() {
    if (!canImport) return;
    setImporting(true);
    setRequestError('');
    setResult(null);
    try {
      const response = await request('/students/import', {
        token,
        method: 'POST',
        body: JSON.stringify({
          groupId: Number(selectedGroupId),
          students: validRows.map(({ student }) => student),
        }),
      });
      setResult(response);
      onImported();
    } catch (error) {
      setRequestError(error.message || 'تعذر الاتصال بالخادم. لم يتم استيراد الطلاب.');
    } finally {
      setImporting(false);
    }
  }

  function closeModal() {
    if (!reading && !importing) onClose();
  }

  return <div className="modal-backdrop student-import-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
    <section className="form-modal student-import-modal" role="dialog" aria-modal="true" aria-labelledby="student-import-title">
      <div className="modal-heading">
        <div><span className="panel-kicker">إضافة جماعية{teacherName ? ` · ${teacherName}` : ''}</span><h2 id="student-import-title">استيراد طلاب من Excel</h2></div>
        <button className="icon-button" aria-label="إغلاق" onClick={closeModal} disabled={reading || importing}><X size={19} /></button>
      </div>

      <label className="form-field student-import-group">
        <span>المجموعة التي سيُسجّل بها الطلاب</span>
        <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)} disabled={importing}>
          <option value="">اختر المجموعة</option>
          {groups.map((group) => <option key={group.id} value={group.id}>{group.teacherName} · {group.subject} · {group.grade} · {group.name}</option>)}
        </select>
      </label>

      <input ref={inputRef} className="student-import-file-input" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={readFile} />
      <button className="student-import-dropzone" type="button" onClick={() => inputRef.current?.click()} disabled={reading || importing}>
        {reading ? <span className="loading-spinner" /> : <FileSpreadsheet size={22} />}
        <span><b>{reading ? 'جارٍ قراءة الملف…' : fileName || 'اختر ملف Excel للمعاينة'}</b><small>يدعم .xlsx و .xls، بحد أقصى 10 ميجابايت</small></span>
        {!reading && <Upload size={17} />}
      </button>
      {fileError && <p className="student-import-message error" role="alert"><AlertCircle size={16} />{fileError}</p>}
      {requestError && <p className="student-import-message error" role="alert"><AlertCircle size={16} />{requestError}</p>}

      {rows.length > 0 && <div className="student-import-preview">
        <div className="student-import-summary">
          <span>الصفوف: <b>{rows.length}</b></span>
          <span>صالحة: <b>{validRows.length}</b></span>
          <span>تحتاج تصحيحًا: <b>{invalidRows.length}</b></span>
          <span>فارغة متجاهلة: <b>{blankRows.length}</b></span>
        </div>
        {exceedsLimit && <p className="student-import-message error"><AlertCircle size={16} />الحد الأقصى للاستيراد 500 طالب في المرة الواحدة. قسّم الملف إلى دفعات أصغر.</p>}
        <div className="student-import-table-wrap">
          <table className="student-import-table">
            <thead><tr><th>صف الملف</th><th>اسم الطالب</th><th>رقم الهاتف</th><th>هاتف ولي الأمر</th><th>الصف الدراسي</th><th>التحقق</th></tr></thead>
            <tbody>{rows.map(({ student, errors }, index) => <tr key={student.rowNumber} className={errors.length ? 'import-row-invalid' : ''}>
              <td>{student.rowNumber}</td>
              <td>{student.name || '—'}</td>
              <td dir="ltr">{student.phone || '—'}</td>
              <td dir="ltr">{student.guardianPhone || '—'}</td>
              <td>{student.grade || '—'}</td>
              <td>{errors.length ? errors.join('، ') : <span className="import-valid"><CheckCircle2 size={14} />صالحة</span>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {result && <div className="student-import-result" role="status">
          <b>اكتمل الاستيراد: تمت إضافة {result.added} طالب.</b>
          <span>تم تجاهل {blankRows.length + invalidRows.length + result.skipped} صفًا (فارغ أو غير صالح أو مكرر).</span>
          {result.errors?.length > 0 && <ul>{result.errors.map((item) => <li key={`${item.rowNumber}-${item.error}`}>الصف {item.rowNumber}: {item.error}</li>)}</ul>}
        </div>}
      </div>}

      <div className="modal-actions">
        <button className="button button-primary" type="button" onClick={confirmImport} disabled={!canImport}>
          {importing ? 'جارٍ استيراد الطلاب…' : result ? 'تم الاستيراد' : 'تأكيد الاستيراد'}
        </button>
        <button className="button button-quiet" type="button" onClick={closeModal} disabled={reading || importing}>إلغاء</button>
      </div>
    </section>
  </div>;
}
