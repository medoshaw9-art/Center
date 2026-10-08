import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cairoDate, shiftDate } from '../services/helpers.js';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dataDirectory=path.join(projectRoot,'data');
fs.mkdirSync(dataDirectory,{recursive:true});
const databasePath=process.env.DB_PATH?path.resolve(projectRoot,process.env.DB_PATH):path.join(dataDirectory,'center.sqlite');
export const db=new Database(databasePath);
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
