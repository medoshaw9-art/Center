const columnAliases = {
  name: [
    'اسم الطالب',
    'اسم الطالب بالكامل',
    'الاسم الكامل للطالب',
    'اسم الطالب رباعي',
    'الاسم رباعي للطالب',
    'الاسم بالكامل',
    'الاسم',
    'student name',
    'full name',
  ],
  phone: [
    'رقم الهاتف',
    'رقم هاتف الطالب',
    'رقم تليفون الطالب',
    'رقم التليفون',
    'رقم الموبايل',
    'رقم الجوال',
    'هاتف الطالب',
    'موبايل الطالب',
    'student phone',
    'phone',
    'mobile',
  ],
  guardianPhone: [
    'رقم هاتف ولي الأمر',
    'رقم هاتف ولى الامر',
    'رقم ولي الأمر',
    'رقم ولى الامر',
    'هاتف ولي الأمر',
    'رقم تليفون ولي الأمر',
    'guardian phone',
    'parent phone',
    'parent phone number',
    'parents phone number',
  ],
  grade: [
    'الصف الدراسي',
    'الصف الدراسى',
    'الصف',
    'المرحلة الدراسية',
    'السنة الدراسية',
    'grade',
    'class',
  ],
  notes: ['ملاحظات إضافية', 'ملاحظات', 'notes'],
};

function normalizeHeader(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function findColumnIndexes(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const result = {};
  const normalizedGuardianAliases = columnAliases.guardianPhone.map(normalizeHeader);
  const isGuardianHeader = (header) =>
    normalizedGuardianAliases.some((alias) => header.includes(alias));

  for (const field of ['name', 'guardianPhone', 'phone', 'grade', 'notes']) {
    const aliases = columnAliases[field];
    const normalizedAliases = aliases.map(normalizeHeader);
    const allowedHeader = (header) =>
      field !== 'phone' || !isGuardianHeader(header);
    const matchesField = (header) =>
      normalizedAliases.some((alias) => header === alias);
    const matchesFieldPartially = (header) =>
      normalizedAliases.some((alias) => header.includes(alias));
    result[field] = normalizedHeaders.findIndex((header) =>
      allowedHeader(header) && matchesField(header),
    );
    if (result[field] < 0) {
      result[field] = normalizedHeaders.findIndex((header) =>
        allowedHeader(header) && matchesFieldPartially(header),
      );
    }
  }

  if (result.name < 0) {
    throw new Error('لم يتم العثور على عمود اسم الطالب. أضف عمودًا باسم "اسم الطالب".');
  }
  return result;
}

function expandExponential(value) {
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) return text;

  const [, sign, integer, fraction = '', exponentText] = match;
  const digits = integer + fraction;
  const decimalPosition = integer.length + Number(exponentText);
  if (decimalPosition <= 0) return `${sign}0.${'0'.repeat(-decimalPosition)}${digits}`;
  if (decimalPosition >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalPosition - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(decimalPosition)}`;
}

function cellText(XLSX, sheet, rowIndex, columnIndex, preservePhoneFormat = false) {
  if (columnIndex < 0) return '';
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  if (!cell || cell.v == null) return '';
  if (typeof cell.v === 'string') return cell.v.trim();
  if (typeof cell.v === 'number') {
    if (preservePhoneFormat && cell.z && /^0{2,}$/.test(cell.z)) {
      return XLSX.utils.format_cell(cell).trim();
    }
    return expandExponential(cell.v);
  }
  return String(cell.v).trim();
}

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeContact(value) {
  const westernDigits = String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
  const digits = westernDigits.replace(/\D/g, '');
  return digits || '';
}

function validateStudent(student) {
  const errors = [];
  if (!student.name) errors.push('اسم الطالب مطلوب');
  if (student.name.length > 120) errors.push('اسم الطالب أطول من الحد المسموح (120 حرفًا)');
  if (student.phone.length > 40) errors.push('رقم هاتف الطالب أطول من الحد المسموح (40 حرفًا)');
  if (student.guardianPhone.length > 40) errors.push('رقم هاتف ولي الأمر أطول من الحد المسموح (40 حرفًا)');
  if (student.grade.length > 80) errors.push('الصف الدراسي أطول من الحد المسموح (80 حرفًا)');
  if (student.notes.length > 1000) errors.push('الملاحظات أطول من الحد المسموح (1000 حرف)');
  return errors;
}

export function parseStudentWorkbook(XLSX, workbook) {
  const sheetName = workbook.SheetNames?.[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet || !sheet['!ref']) {
    throw new Error('الملف فارغ أو لا يحتوي على ورقة عمل بها بيانات.');
  }

  const range = XLSX.utils.decode_range(sheet['!ref']);
  if (range.e.r - range.s.r > 5000 || range.e.c - range.s.c > 100) {
    throw new Error('حجم جدول Excel أكبر من الحد المدعوم. قسّم البيانات إلى ملفات أصغر.');
  }
  let headerRow = -1;
  let headers = [];
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const values = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      values.push(cellText(XLSX, sheet, row, column));
    }
    if (values.some((value) => value !== '')) {
      headerRow = row;
      headers = values;
      break;
    }
  }
  if (headerRow < 0) throw new Error('الملف لا يحتوي على بيانات.');

  const columns = findColumnIndexes(headers);
  const blankRows = [];
  const rows = [];

  for (let rowIndex = headerRow + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const values = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      values.push(cellText(XLSX, sheet, rowIndex, column));
    }
    if (values.every((value) => value === '')) {
      blankRows.push(rowIndex + 1);
      continue;
    }

    const valueAt = (columnIndex) =>
      columnIndex < 0
        ? ''
        : cellText(
            XLSX,
            sheet,
            rowIndex,
            range.s.c + columnIndex,
            columnIndex === columns.phone || columnIndex === columns.guardianPhone,
          );
    const student = {
      rowNumber: rowIndex + 1,
      name: valueAt(columns.name).trim(),
      phone: valueAt(columns.phone).trim(),
      guardianPhone: valueAt(columns.guardianPhone).trim(),
      grade: valueAt(columns.grade).trim(),
      notes: valueAt(columns.notes).trim(),
    };
    rows.push({ student, errors: validateStudent(student), duplicate: false });
  }

  const seen = new Set();
  for (const row of rows) {
    const { student } = row;
    const name = normalizeName(student.name);
    const contacts = [normalizeContact(student.phone), normalizeContact(student.guardianPhone)]
      .filter(Boolean);
    if (row.errors.length || !contacts.length) continue;
    const keys = contacts.map((contact) => `${name}:${contact}`);
    if (keys.some((key) => seen.has(key))) {
      row.duplicate = true;
      row.errors.push('هذا الطالب مكرر في الملف (الاسم ورقم الهاتف متطابقان)');
    } else {
      keys.forEach((key) => seen.add(key));
    }
  }

  return { rows, blankRows, headers };
}
