import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import express from "express";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(directory, "../data");
fs.mkdirSync(dataDirectory, { recursive: true });
const db = new Database(
  process.env.DB_PATH || path.join(dataDirectory, "center.sqlite"),
);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
    photo TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'teacher')), teacher_id INTEGER REFERENCES teachers(id),
    active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, teacher_id INTEGER NOT NULL REFERENCES teachers(id),
    name TEXT NOT NULL, subject TEXT NOT NULL, grade TEXT NOT NULL, grade_level TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '', guardian_phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL REFERENCES students(id),
    group_id INTEGER NOT NULL REFERENCES groups(id), active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(student_id, group_id)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL REFERENCES groups(id),
    session_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, session_date)
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL REFERENCES sessions(id),
    student_id INTEGER NOT NULL REFERENCES students(id),
    status TEXT NOT NULL CHECK(status IN ('present', 'absent')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(session_id, student_id)
  );
  CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
  CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(session_date);
`);
const teacherColumns = new Set(
  db.pragma("table_info(teachers)").map((column) => column.name),
);
if (!teacherColumns.has("photo")) {
  db.exec("ALTER TABLE teachers ADD COLUMN photo TEXT NOT NULL DEFAULT ''");
}
const groupColumns = new Set(
  db.pragma("table_info(groups)").map((column) => column.name),
);
if (!groupColumns.has("schedule")) {
  db.exec("ALTER TABLE groups ADD COLUMN schedule TEXT NOT NULL DEFAULT ''");
}
if (!groupColumns.has("grade_level")) {
  db.exec("ALTER TABLE groups ADD COLUMN grade_level TEXT NOT NULL DEFAULT ''");
}

function cairoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDate(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function isValidTeacherPhoto(photo) {
  return (
    typeof photo === "string" &&
    photo.length <= 2_100_000 &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)
  );
}

const fixedGradeLabels = {
  first: "الأول الثانوي",
  second: "الثاني الثانوي",
  third: "الثالث الثانوي",
};

const normalizeGroupGrade = (gradeLevel, fallbackGrade = "") => {
  const normalized = String(gradeLevel || "").trim();
  if (normalized && fixedGradeLabels[normalized])
    return fixedGradeLabels[normalized];
  const current = String(fallbackGrade || "").trim();
  return current && Object.values(fixedGradeLabels).includes(current)
    ? current
    : "الثالث الثانوي";
};

const seed = db.transaction(() => {
  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count) return;
  const addTeacher = db.prepare(
    "INSERT INTO teachers (name, phone) VALUES (?, ?)",
  );
  const addUser = db.prepare(
    "INSERT INTO users (username, password_hash, role, teacher_id) VALUES (?, ?, ?, ?)",
  );
  const addGroup = db.prepare(
    "INSERT INTO groups (teacher_id, name, subject, grade) VALUES (?, ?, ?, ?)",
  );
  const addStudent = db.prepare(
    "INSERT INTO students (name, phone, grade, guardian_phone) VALUES (?, ?, ?, ?)",
  );
  const addEnrollment = db.prepare(
    "INSERT INTO enrollments (student_id, group_id) VALUES (?, ?)",
  );
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "markaz123";
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
    throw new Error(
      "Set ADMIN_PASSWORD before initializing a production database",
    );
  }
  addUser.run(adminUsername, bcrypt.hashSync(adminPassword, 10), "admin", null);
  if (process.env.NODE_ENV === "production") return;
  const teacherData = [
    ["أحمد محمد", "01012345678", "رياضيات", "الثالث الثانوي", "مجموعة A"],
    ["منى إبراهيم", "01123456789", "فيزياء", "الثالث الثانوي", "مجموعة B"],
    ["خالد حسن", "01234567890", "كيمياء", "الثاني الثانوي", "مجموعة A"],
  ];
  const groups = teacherData.map(([name, phone, subject, grade, groupName]) => {
    const teacherId = Number(addTeacher.run(name, phone).lastInsertRowid);
    return {
      id: Number(
        addGroup.run(teacherId, groupName, subject, grade).lastInsertRowid,
      ),
      grade,
    };
  });
  const students = [
    ["محمد أحمد", "01020000001", 0],
    ["محمود علي", "01020000002", 0],
    ["أحمد حسن", "01020000003", 0],
    ["سارة محمود", "01020000004", 0],
    ["عمر خالد", "01020000005", 0],
    ["نور الدين سامي", "01020000006", 0],
    ["ليلى أشرف", "01020000007", 1],
    ["يوسف عادل", "01020000008", 1],
    ["مريم مصطفى", "01020000009", 1],
    ["زياد طارق", "01020000010", 1],
    ["ملك هشام", "01020000011", 2],
    ["آدم شريف", "01020000012", 2],
  ];
  const today = cairoDate();
  students.forEach(([name, phone, groupIndex], index) => {
    const group = groups[groupIndex];
    const studentId = Number(
      addStudent.run(
        name,
        phone,
        group.grade,
        `010300000${String(index + 1).padStart(2, "0")}`,
      ).lastInsertRowid,
    );
    addEnrollment.run(studentId, group.id);
    const date = index % 3 === 0 ? shiftDate(today, -1) : today;
    const sessionId = Number(
      db
        .prepare(
          "INSERT INTO sessions (group_id, session_date) VALUES (?, ?) ON CONFLICT(group_id, session_date) DO UPDATE SET session_date = excluded.session_date RETURNING id",
        )
        .get(group.id, date).id,
    );
    db.prepare(
      "INSERT INTO attendance (session_id, student_id, status) VALUES (?, ?, ?)",
    ).run(sessionId, studentId, index % 4 === 0 ? "absent" : "present");
  });
});
seed();

const app = express();
app.use(express.json({ limit: "3mb" }));
const jwtSecret =
  process.env.JWT_SECRET || "development-only-change-before-deploying";
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("Set JWT_SECRET before starting in production");
}

function authenticate(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "يلزم تسجيل الدخول" });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db
      .prepare(
        "SELECT id, username, role, teacher_id, active FROM users WHERE id = ?",
      )
      .get(payload.id);
    if (!user?.active || user.role !== "admin")
      return response.status(401).json({ error: "يلزم تسجيل الدخول كمدير" });
    request.user = user;
    next();
  } catch {
    response
      .status(401)
      .json({ error: "انتهت جلسة الدخول، سجل الدخول مجددًا" });
  }
}

function requireAdmin(request, response, next) {
  if (request.user.role !== "admin")
    return response.status(403).json({ error: "هذه العملية متاحة للمدير فقط" });
  next();
}

function canAccessGroup(user, groupId) {
  return (
    user.role === "admin" ||
    Boolean(
      db
        .prepare(
          "SELECT 1 FROM groups WHERE id = ? AND teacher_id = ? AND active = 1",
        )
        .get(groupId, user.teacher_id),
    )
  );
}

function canAccessStudent(user, studentId) {
  return (
    user.role === "admin" ||
    Boolean(
      db
        .prepare(
          `
    SELECT 1 FROM enrollments e JOIN groups g ON g.id = e.group_id
    WHERE e.student_id = ? AND e.active = 1 AND g.teacher_id = ? AND g.active = 1
  `,
        )
        .get(studentId, user.teacher_id),
    )
  );
}

function requireGroupAccess(request, response, next) {
  const id = Number(request.params.groupId || request.params.id);
  if (!canAccessGroup(request.user, id))
    return response.status(404).json({ error: "المجموعة غير موجودة" });
  next();
}

function requireStudentAccess(request, response, next) {
  if (!canAccessStudent(request.user, Number(request.params.id)))
    return response.status(404).json({ error: "الطالب غير موجود" });
  next();
}

app.get("/api/health", (request, response) => response.json({ ok: true }));

app.post("/api/auth/login", (request, response) => {
  const { username, password } = request.body || {};
  const user = db
    .prepare(
      `SELECT u.id, u.username, u.password_hash, u.role, u.teacher_id, t.name
    FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.username = ? AND u.active = 1`,
    )
    .get(String(username || "").trim());
  if (
    !user ||
    user.role !== "admin" ||
    !bcrypt.compareSync(String(password || ""), user.password_hash)
  )
    return response
      .status(401)
      .json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: "12h" });
  response.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      teacherId: user.teacher_id,
      name: user.name || "مدير السنتر",
    },
  });
});

app.get("/api/auth/me", authenticate, (request, response) => {
  const user = db
    .prepare(
      "SELECT u.id, u.username, u.role, u.teacher_id, t.name FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id WHERE u.id = ?",
    )
    .get(request.user.id);
  response.json({
    id: user.id,
    username: user.username,
    role: user.role,
    teacherId: user.teacher_id,
    name: user.name || "مدير السنتر",
  });
});

app.get("/api/dashboard", authenticate, (request, response) => {
  const user = request.user;
  const scope = user.role === "teacher" ? "AND g.teacher_id = @teacherId" : "";
  const parameters = { today: cairoDate(), teacherId: user.teacher_id };
  const teachers =
    user.role === "admin"
      ? db
          .prepare("SELECT COUNT(*) AS count FROM teachers WHERE active = 1")
          .get().count
      : 1;
  const studentSql =
    user.role === "admin"
      ? "SELECT COUNT(*) AS count FROM students WHERE active = 1"
      : "SELECT COUNT(DISTINCT s.id) AS count FROM students s JOIN enrollments e ON e.student_id=s.id JOIN groups g ON g.id=e.group_id WHERE s.active=1 AND e.active=1 AND g.active=1 AND g.teacher_id=@teacherId";
  const students = db
    .prepare(studentSql)
    .get(user.role === "admin" ? {} : { teacherId: user.teacher_id }).count;
  const todayCounts = db
    .prepare(
      `SELECT a.status, COUNT(*) AS count FROM attendance a
    JOIN sessions se ON se.id=a.session_id JOIN groups g ON g.id=se.group_id
    WHERE se.session_date=@today ${scope} GROUP BY a.status`,
    )
    .all(user.role === "admin" ? { today: parameters.today } : parameters);
  const counts = Object.fromEntries(
    todayCounts.map((row) => [row.status, row.count]),
  );
  const recent = db
    .prepare(
      `SELECT s.id, s.name, s.phone, s.created_at AS createdAt,
      GROUP_CONCAT(DISTINCT t.name) AS teachers, GROUP_CONCAT(DISTINCT g.subject) AS subjects,
      GROUP_CONCAT(DISTINCT g.name) AS groups
    FROM students s JOIN enrollments e ON e.student_id=s.id JOIN groups g ON g.id=e.group_id
    JOIN teachers t ON t.id=g.teacher_id WHERE s.active=1 AND e.active=1 ${scope}
    GROUP BY s.id ORDER BY s.created_at DESC LIMIT 5`,
    )
    .all(user.role === "admin" ? {} : { teacherId: user.teacher_id });
  response.json({
    teachers,
    students,
    present: counts.present || 0,
    absent: counts.absent || 0,
    recent,
    today: parameters.today,
  });
});

app.get("/api/teachers", authenticate, requireAdmin, (request, response) => {
  response.json(
    db
      .prepare(
        `SELECT t.id, t.name, t.phone, t.photo, t.active,
    COUNT(DISTINCT g.id) AS groupCount, COUNT(DISTINCT e.student_id) AS studentCount,
    GROUP_CONCAT(DISTINCT g.subject) AS subjects, GROUP_CONCAT(DISTINCT g.grade) AS grades
    FROM teachers t
    LEFT JOIN groups g ON g.teacher_id=t.id AND g.active=1
    LEFT JOIN enrollments e ON e.group_id=g.id AND e.active=1
    WHERE t.active=1 GROUP BY t.id ORDER BY t.name`,
      )
      .all(),
  );
});

app.post("/api/teachers", authenticate, requireAdmin, (request, response) => {
  const {
    name,
    phone = "",
    subject,
    grade = "الثالث الثانوي",
    photo = "",
  } = request.body || {};
  if (!name?.trim() || !subject?.trim())
    return response.status(400).json({ error: "أكمل اسم المدرس والمادة" });
  if (photo && !isValidTeacherPhoto(photo))
    return response
      .status(400)
      .json({ error: "الصورة غير صالحة أو حجمها كبير" });
  const normalizedGrade =
    String(grade || "الثالث الثانوي").trim() || "الثالث الثانوي";
  try {
    const create = db.transaction(() => {
      const id = Number(
        db
          .prepare("INSERT INTO teachers (name, phone, photo) VALUES (?, ?, ?)")
          .run(name.trim(), phone.trim(), photo).lastInsertRowid,
      );
      db.prepare(
        "INSERT INTO groups (teacher_id, name, subject, grade) VALUES (?, ?, ?, ?)",
      ).run(id, "مجموعة A", subject.trim(), normalizedGrade);
      return id;
    });
    response.status(201).json({ id: create() });
  } catch (error) {
    throw error;
  }
});

app.put(
  "/api/teachers/:id",
  authenticate,
  requireAdmin,
  (request, response) => {
    const { name, phone = "", photo } = request.body || {};
    if (!name?.trim())
      return response.status(400).json({ error: "اسم المدرس مطلوب" });
    if (photo !== undefined && photo !== "" && !isValidTeacherPhoto(photo))
      return response
        .status(400)
        .json({ error: "الصورة غير صالحة أو حجمها كبير" });
    const result = db
      .prepare(
        photo === undefined
          ? "UPDATE teachers SET name=?, phone=? WHERE id=? AND active=1"
          : "UPDATE teachers SET name=?, phone=?, photo=? WHERE id=? AND active=1",
      )
      .run(
        ...(photo === undefined
          ? [name.trim(), phone.trim(), request.params.id]
          : [name.trim(), phone.trim(), photo, request.params.id]),
      );
    if (!result.changes)
      return response.status(404).json({ error: "المدرس غير موجود" });
    response.json({ ok: true });
  },
);

app.delete(
  "/api/teachers/:id",
  authenticate,
  requireAdmin,
  (request, response) => {
    const deleted = db.transaction((id) => {
      const exclusiveStudents = db
        .prepare(
          `SELECT DISTINCT e.student_id AS id FROM enrollments e
          JOIN groups g ON g.id=e.group_id
          WHERE g.teacher_id=? AND e.active=1 AND NOT EXISTS (
            SELECT 1 FROM enrollments other
            JOIN groups other_group ON other_group.id=other.group_id
            WHERE other.student_id=e.student_id AND other.active=1 AND other_group.teacher_id<>?
          )`,
        )
        .all(id, id)
        .map((student) => student.id);
      db.prepare(
        `DELETE FROM attendance WHERE session_id IN (
        SELECT id FROM sessions WHERE group_id IN (SELECT id FROM groups WHERE teacher_id=?)
      )`,
      ).run(id);
      db.prepare(
        "DELETE FROM sessions WHERE group_id IN (SELECT id FROM groups WHERE teacher_id=?)",
      ).run(id);
      db.prepare(
        "DELETE FROM enrollments WHERE group_id IN (SELECT id FROM groups WHERE teacher_id=?)",
      ).run(id);
      for (const studentId of exclusiveStudents) {
        db.prepare("DELETE FROM attendance WHERE student_id=?").run(studentId);
        db.prepare("DELETE FROM enrollments WHERE student_id=?").run(studentId);
        db.prepare("DELETE FROM students WHERE id=?").run(studentId);
      }
      db.prepare("DELETE FROM groups WHERE teacher_id=?").run(id);
      db.prepare("DELETE FROM users WHERE teacher_id=?").run(id);
      return db.prepare("DELETE FROM teachers WHERE id=?").run(id).changes;
    })(Number(request.params.id));
    if (!deleted)
      return response.status(404).json({ error: "المدرس غير موجود" });
    response.json({ ok: true });
  },
);

app.get("/api/groups", authenticate, (request, response) => {
  const isTeacher = request.user.role === "teacher";
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.subject, g.grade, g.grade_level AS gradeLevel, g.schedule, g.teacher_id AS teacherId,
    t.name AS teacherName, COUNT(DISTINCT e.student_id) AS studentCount
    FROM groups g JOIN teachers t ON t.id=g.teacher_id
    LEFT JOIN enrollments e ON e.group_id=g.id AND e.active=1
    WHERE g.active=1 ${isTeacher ? "AND g.teacher_id=?" : ""}
    GROUP BY g.id ORDER BY t.name, g.subject, g.name`,
    )
    .all(...(isTeacher ? [request.user.teacher_id] : []));
  response.json(groups);
});

app.post(
  "/api/groups/bulk",
  authenticate,
  requireAdmin,
  (request, response) => {
    const {
      teacherId,
      subject,
      grade,
      gradeLevel = "",
      schedule,
      names,
    } = request.body || {};
    const cleanNames = Array.isArray(names)
      ? names.map((name) => String(name).trim())
      : [];
    if (
      !teacherId ||
      !subject?.trim() ||
      !schedule?.trim() ||
      cleanNames.length < 1 ||
      cleanNames.length > 20 ||
      cleanNames.some((name) => !name || name.length > 80)
    )
      return response.status(400).json({ error: "أكمل بيانات المجموعات" });
    const normalizedTeacherId = Number(teacherId);
    if (!Number.isInteger(normalizedTeacherId))
      return response.status(400).json({ error: "المدرس غير موجود" });
    const teacher = db
      .prepare("SELECT id FROM teachers WHERE id=? AND active=1")
      .get(normalizedTeacherId);
    if (!teacher)
      return response.status(400).json({ error: "المدرس غير موجود" });
    const normalizedGradeLevel = ["first", "second", "third"].includes(
      String(gradeLevel),
    )
      ? String(gradeLevel)
      : "";
    const normalizedGrade = normalizeGroupGrade(normalizedGradeLevel, grade);
    const insertGroup = db.prepare(
      "INSERT INTO groups (teacher_id,name,subject,grade,grade_level,schedule) VALUES (?,?,?,?,?,?)",
    );
    const createGroups = db.transaction(() =>
      cleanNames.map((name) =>
        Number(
          insertGroup.run(
            normalizedTeacherId,
            name,
            subject.trim(),
            normalizedGrade,
            normalizedGradeLevel,
            schedule.trim(),
          ).lastInsertRowid,
        ),
      ),
    );
    response.status(201).json({ ids: createGroups() });
  },
);

app.post("/api/groups", authenticate, requireAdmin, (request, response) => {
  const {
    teacherId,
    name,
    subject,
    grade,
    gradeLevel = "",
    schedule,
  } = request.body || {};
  if (!teacherId || !subject?.trim() || !schedule?.trim())
    return response.status(400).json({ error: "أكمل بيانات المجموعة" });
  const normalizedTeacherId = Number(teacherId);
  if (!Number.isInteger(normalizedTeacherId))
    return response.status(400).json({ error: "المدرس غير موجود" });
  const teacher = db
    .prepare("SELECT id FROM teachers WHERE id=? AND active=1")
    .get(normalizedTeacherId);
  if (!teacher) return response.status(400).json({ error: "المدرس غير موجود" });
  const normalizedGradeLevel = ["first", "second", "third"].includes(
    String(gradeLevel),
  )
    ? String(gradeLevel)
    : "";
  const normalizedGrade = normalizeGroupGrade(normalizedGradeLevel, grade);
  const result = db
    .prepare(
      "INSERT INTO groups (teacher_id,name,subject,grade,grade_level,schedule) VALUES (?,?,?,?,?,?)",
    )
    .run(
      normalizedTeacherId,
      name?.trim() || "مجموعة A",
      subject.trim(),
      normalizedGrade,
      normalizedGradeLevel,
      schedule.trim(),
    );
  response.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.put("/api/groups/:id", authenticate, requireAdmin, (request, response) => {
  const {
    teacherId,
    name,
    subject,
    grade,
    gradeLevel = "",
    schedule,
  } = request.body || {};
  if (
    !teacherId ||
    !subject?.trim() ||
    !schedule?.trim() ||
    (name !== undefined && !name.trim())
  )
    return response.status(400).json({ error: "أكمل بيانات المجموعة" });
  const teacher = db
    .prepare("SELECT id FROM teachers WHERE id=? AND active=1")
    .get(teacherId);
  if (!teacher) return response.status(400).json({ error: "المدرس غير موجود" });
  const normalizedGradeLevel = ["first", "second", "third"].includes(
    String(gradeLevel),
  )
    ? String(gradeLevel)
    : "";
  const currentGroup = db
    .prepare(
      "SELECT grade, grade_level, name FROM groups WHERE id=? AND active=1",
    )
    .get(request.params.id);
  if (!currentGroup)
    return response.status(404).json({ error: "المجموعة غير موجودة" });
  const normalizedGrade = normalizeGroupGrade(
    normalizedGradeLevel,
    grade || currentGroup.grade,
  );
  const result = db
    .prepare(
      "UPDATE groups SET teacher_id=?,name=?,subject=?,grade=?,grade_level=?,schedule=? WHERE id=? AND active=1",
    )
    .run(
      teacherId,
      name?.trim() || currentGroup.name || "مجموعة A",
      subject.trim(),
      normalizedGrade,
      normalizedGradeLevel || currentGroup.grade_level || "",
      schedule.trim(),
      request.params.id,
    );
  if (!result.changes)
    return response.status(404).json({ error: "المجموعة غير موجودة" });
  response.json({ ok: true });
});

app.get("/api/students", authenticate, (request, response) => {
  const filters = ["s.active=1", "e.active=1", "g.active=1"];
  const values = [];
  const search = String(request.query.search || "").trim();
  const groupId = Number(request.query.groupId || 0);
  const teacherId = Number(request.query.teacherId || 0);
  if (request.user.role === "teacher") {
    filters.push("g.teacher_id=?");
    values.push(request.user.teacher_id);
  }
  if (teacherId) {
    if (
      request.user.role === "teacher" &&
      teacherId !== request.user.teacher_id
    )
      return response
        .status(403)
        .json({ error: "غير مسموح بعرض طلاب هذا المدرس" });
    filters.push("g.teacher_id=?");
    values.push(teacherId);
  }
  if (groupId) {
    filters.push("g.id=?");
    values.push(groupId);
  }
  if (search) {
    filters.push(
      "(s.name LIKE ? OR s.phone LIKE ? OR s.guardian_phone LIKE ?)",
    );
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  response.json(
    db
      .prepare(
        `SELECT s.id, s.name, s.phone, s.grade, s.guardian_phone AS guardianPhone, s.notes,
      GROUP_CONCAT(DISTINCT t.name) AS teachers, GROUP_CONCAT(DISTINCT g.subject) AS subjects,
      GROUP_CONCAT(DISTINCT g.name) AS groups, GROUP_CONCAT(DISTINCT g.id) AS groupIds
    FROM students s JOIN enrollments e ON e.student_id=s.id JOIN groups g ON g.id=e.group_id
    JOIN teachers t ON t.id=g.teacher_id WHERE ${filters.join(" AND ")}
    GROUP BY s.id ORDER BY s.name`,
      )
      .all(...values),
  );
});

app.post("/api/students", authenticate, (request, response) => {
  const {
    name,
    phone = "",
    grade = "",
    guardianPhone = "",
    notes = "",
    groupId,
  } = request.body || {};
  if (!name?.trim() || !groupId)
    return response.status(400).json({ error: "اسم الطالب والمجموعة مطلوبان" });
  if (!canAccessGroup(request.user, Number(groupId)))
    return response.status(404).json({ error: "المجموعة غير موجودة" });
  const create = db.transaction(() => {
    const id = Number(
      db
        .prepare(
          "INSERT INTO students (name,phone,grade,guardian_phone,notes) VALUES (?,?,?,?,?)",
        )
        .run(
          name.trim(),
          phone.trim(),
          grade.trim(),
          guardianPhone.trim(),
          notes.trim(),
        ).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO enrollments (student_id,group_id) VALUES (?,?)",
    ).run(id, groupId);
    return id;
  });
  response.status(201).json({ id: create() });
});

app.get(
  "/api/students/:id",
  authenticate,
  requireStudentAccess,
  (request, response) => {
    const student = db
      .prepare(
        "SELECT id,name,phone,grade,guardian_phone AS guardianPhone,notes FROM students WHERE id=? AND active=1",
      )
      .get(request.params.id);
    if (!student)
      return response.status(404).json({ error: "الطالب غير موجود" });
    const scope = request.user.role === "teacher" ? "AND g.teacher_id=?" : "";
    const values =
      request.user.role === "teacher"
        ? [request.params.id, request.user.teacher_id]
        : [request.params.id];
    student.groups = db
      .prepare(
        `SELECT g.id,g.name,g.subject,g.grade,t.name AS teacherName FROM enrollments e
    JOIN groups g ON g.id=e.group_id JOIN teachers t ON t.id=g.teacher_id
    WHERE e.student_id=? AND e.active=1 AND g.active=1 ${scope}`,
      )
      .all(...values);
    student.attendance = db
      .prepare(
        `SELECT se.session_date AS date,a.status,g.name AS groupName,g.subject,t.name AS teacherName
    FROM attendance a JOIN sessions se ON se.id=a.session_id JOIN groups g ON g.id=se.group_id
    JOIN teachers t ON t.id=g.teacher_id WHERE a.student_id=? ${scope} ORDER BY se.session_date DESC,a.id DESC`,
      )
      .all(...values);
    const total = student.attendance.length;
    student.attendanceRate = total
      ? Math.round(
          (student.attendance.filter((item) => item.status === "present")
            .length /
            total) *
            100,
        )
      : null;
    response.json(student);
  },
);

app.put(
  "/api/students/:id",
  authenticate,
  requireStudentAccess,
  (request, response) => {
    const {
      name,
      phone = "",
      grade = "",
      guardianPhone = "",
      notes = "",
    } = request.body || {};
    if (!name?.trim())
      return response.status(400).json({ error: "اسم الطالب مطلوب" });
    const result = db
      .prepare(
        "UPDATE students SET name=?,phone=?,grade=?,guardian_phone=?,notes=? WHERE id=? AND active=1",
      )
      .run(
        name.trim(),
        phone.trim(),
        grade.trim(),
        guardianPhone.trim(),
        notes.trim(),
        request.params.id,
      );
    if (!result.changes)
      return response.status(404).json({ error: "الطالب غير موجود" });
    response.json({ ok: true });
  },
);

app.post(
  "/api/students/:id/enrollments",
  authenticate,
  requireStudentAccess,
  (request, response) => {
    const { groupId } = request.body || {};
    if (!groupId || !canAccessGroup(request.user, Number(groupId))) {
      return response.status(404).json({ error: "المجموعة غير موجودة" });
    }
    try {
      db.prepare(
        "INSERT INTO enrollments (student_id,group_id) VALUES (?,?)",
      ).run(request.params.id, groupId);
      response.status(201).json({ ok: true });
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return response
          .status(409)
          .json({ error: "الطالب مسجل في هذه المجموعة بالفعل" });
      }
      throw error;
    }
  },
);

app.delete(
  "/api/students/:id",
  authenticate,
  requireAdmin,
  (request, response) => {
    const deleted = db.transaction((id) => {
      db.prepare("DELETE FROM attendance WHERE student_id=?").run(id);
      db.prepare("DELETE FROM enrollments WHERE student_id=?").run(id);
      return db.prepare("DELETE FROM students WHERE id=?").run(id).changes;
    })(Number(request.params.id));
    if (!deleted)
      return response.status(404).json({ error: "الطالب غير موجود" });
    response.json({ ok: true });
  },
);

app.get(
  "/api/groups/:groupId/attendance",
  authenticate,
  requireGroupAccess,
  (request, response) => {
    const date = String(request.query.date || cairoDate());
    const session = db
      .prepare("SELECT id FROM sessions WHERE group_id=? AND session_date=?")
      .get(request.params.groupId, date);
    const students = db
      .prepare(
        `SELECT s.id,s.name,s.phone,a.status FROM enrollments e
    JOIN students s ON s.id=e.student_id LEFT JOIN attendance a ON a.student_id=s.id AND a.session_id=?
    WHERE e.group_id=? AND e.active=1 AND s.active=1 ORDER BY s.name`,
      )
      .all(session?.id || -1, request.params.groupId);
    response.json({ sessionId: session?.id || null, date, students });
  },
);

app.put(
  "/api/groups/:groupId/attendance",
  authenticate,
  requireGroupAccess,
  (request, response) => {
    const { date = cairoDate(), entries = [] } = request.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(entries))
      return response.status(400).json({ error: "بيانات الحضور غير صالحة" });
    const save = db.transaction(() => {
      const sessionId = Number(
        db
          .prepare(
            `INSERT INTO sessions (group_id,session_date) VALUES (?,?)
      ON CONFLICT(group_id,session_date) DO UPDATE SET session_date=excluded.session_date RETURNING id`,
          )
          .get(request.params.groupId, date).id,
      );
      const enrolled = new Set(
        db
          .prepare(
            "SELECT student_id FROM enrollments WHERE group_id=? AND active=1",
          )
          .all(request.params.groupId)
          .map((row) => row.student_id),
      );
      const upsert =
        db.prepare(`INSERT INTO attendance (session_id,student_id,status) VALUES (?,?,?)
      ON CONFLICT(session_id,student_id) DO UPDATE SET status=excluded.status,updated_at=CURRENT_TIMESTAMP`);
      for (const entry of entries) {
        if (
          enrolled.has(Number(entry.studentId)) &&
          ["present", "absent"].includes(entry.status)
        )
          upsert.run(sessionId, Number(entry.studentId), entry.status);
      }
      return sessionId;
    });
    response.json({ ok: true, sessionId: save() });
  },
);

const builtClient = path.resolve(directory, "../dist");
if (fs.existsSync(builtClient)) {
  app.use(express.static(builtClient));
  app.get("/{*path}", (request, response, next) => {
    if (request.path.startsWith("/api/")) return next();
    response.sendFile(path.join(builtClient, "index.html"));
  });
}

app.use((error, request, response, next) => {
  console.error(error);
  if (response.headersSent) return next(error);
  const payload = { error: "حدث خطأ غير متوقع" };
  if (process.env.NODE_ENV !== "production") payload.details = error.message;
  response.status(500).json(payload);
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () =>
  console.log(`Center API listening on http://localhost:${port}`),
);
