import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database.js';
import { login, getCurrentUser } from '../controllers/auth.js';
import { importStudents } from '../controllers/students.js';

import {
  authenticate,
  requireAdmin,
  requireGroupAccess,
  requireStudentAccess,
  canAccessGroup,
} from "../middleware/auth.js";

import { cairoDate, fixedGradeLabels, isValidTeacherPhoto, normalizeGroupGrade, shiftDate } from '../services/helpers.js';

const router=express.Router();

router.get("/api/health", (request, response) => {
  let dbStatus = "ok";
  try {
    db.prepare("SELECT 1").get();
  } catch (error) {
    dbStatus = "unavailable";
  }
  response.json({
    ok: dbStatus === "ok",
    status: dbStatus,
    app: "center-backend",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

router.post("/api/auth/login", login);

router.get("/api/auth/me", authenticate, getCurrentUser);

router.get("/api/dashboard", authenticate, (request, response) => {
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

router.get("/api/teachers", authenticate, requireAdmin, (request, response) => {
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

router.post("/api/teachers", authenticate, requireAdmin, (request, response) => {
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
      const username = `teacher_${id}`;
      db.prepare(
        "INSERT INTO users (username, password_hash, role, teacher_id) VALUES (?, ?, ?, ?)",
      ).run(
        username,
        bcrypt.hashSync("teacher123", 10),
        "teacher",
        id,
      );
      return id;
    });
    response.status(201).json({ id: create() });
  } catch (error) {
    throw error;
  }
});

router.put(
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

router.delete(
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

router.get("/api/groups", authenticate, (request, response) => {
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

router.post(
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
    const rawGradeLevel = String(gradeLevel || "").trim();
    const normalizedGradeLevel = ["first", "second", "third"].includes(
      rawGradeLevel,
    )
      ? rawGradeLevel
      : rawGradeLevel;
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

router.post("/api/groups", authenticate, requireAdmin, (request, response) => {
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
  const rawGradeLevel = String(gradeLevel || "").trim();
  const normalizedGradeLevel = ["first", "second", "third"].includes(
    rawGradeLevel,
  )
    ? rawGradeLevel
    : rawGradeLevel;
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

router.put("/api/groups/:id", authenticate, requireAdmin, (request, response) => {
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
  const rawGradeLevel = String(gradeLevel || "").trim();
  const normalizedGradeLevel = ["first", "second", "third"].includes(
    rawGradeLevel,
  )
    ? rawGradeLevel
    : rawGradeLevel;
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

router.delete("/api/groups/:id", authenticate, requireAdmin, (request, response) => {
  const groupId = Number(request.params.id);
  if (!Number.isInteger(groupId) || groupId <= 0)
    return response.status(400).json({ error: "المجموعة غير موجودة" });
  const deleteGroup = db.transaction(() => {
    const group = db
      .prepare("SELECT id FROM groups WHERE id=? AND active=1")
      .get(groupId);
    if (!group) return false;
    db.prepare(
      "DELETE FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE group_id=?)",
    ).run(groupId);
    db.prepare("DELETE FROM sessions WHERE group_id=?").run(groupId);
    db.prepare("DELETE FROM enrollments WHERE group_id=?").run(groupId);
    db.prepare("DELETE FROM groups WHERE id=?").run(groupId);
    return true;
  });
  if (!deleteGroup())
    return response.status(404).json({ error: "المجموعة غير موجودة" });
  response.json({ ok: true });
});

router.put(
  "/api/teachers/:teacherId/grade-labels",
  authenticate,
  requireAdmin,
  (request, response) => {
    const { from, to } = request.body || {};
    const fromLabel = String(from || "").trim();
    const toLabel = String(to || "").trim();
    if (!fromLabel || !toLabel)
      return response.status(400).json({ error: "اسم الصف مطلوب" });
    const teacher = db
      .prepare("SELECT id FROM teachers WHERE id=? AND active=1")
      .get(Number(request.params.teacherId));
    if (!teacher)
      return response.status(404).json({ error: "المدرس غير موجود" });
    const sourceGrade = fixedGradeLabels[fromLabel] || fromLabel;
    const result = db
      .prepare(
        "UPDATE groups SET grade=?, grade_level=? WHERE teacher_id=? AND active=1 AND (grade=? OR grade_level=?)",
      )
      .run(toLabel, "", Number(request.params.teacherId), sourceGrade, fromLabel);
    if (!result.changes)
      return response.status(404).json({ error: "لا توجد مجموعات لهذا الصف" });
    response.json({ ok: true });
  },
);

router.delete(
  "/api/teachers/:teacherId/grade-labels",
  authenticate,
  requireAdmin,
  (request, response) => {
    const label = String(request.body?.label || "").trim();
    if (!label)
      return response.status(400).json({ error: "اسم الصف مطلوب" });
    const teacher = db
      .prepare("SELECT id FROM teachers WHERE id=? AND active=1")
      .get(Number(request.params.teacherId));
    if (!teacher)
      return response.status(404).json({ error: "المدرس غير موجود" });
    const sourceGrade = fixedGradeLabels[label] || label;
    const deleteGradeGroups = db.transaction(() => {
      const groupIds = db
        .prepare(
          "SELECT id FROM groups WHERE teacher_id=? AND active=1 AND (grade=? OR grade_level=?)",
        )
        .all(Number(request.params.teacherId), sourceGrade, label)
        .map((group) => group.id);
      if (!groupIds.length) return 0;
      const placeholders = groupIds.map(() => "?").join(",");
      const sessionIds = db
        .prepare(`SELECT id FROM sessions WHERE group_id IN (${placeholders})`)
        .all(...groupIds)
        .map((session) => session.id);
      if (sessionIds.length) {
        const sessionPlaceholders = sessionIds.map(() => "?").join(",");
        db.prepare(
          `DELETE FROM attendance WHERE session_id IN (${sessionPlaceholders})`,
        ).run(...sessionIds);
      }
      db.prepare(
        `DELETE FROM sessions WHERE group_id IN (${placeholders})`,
      ).run(...groupIds);
      db.prepare(
        `DELETE FROM enrollments WHERE group_id IN (${placeholders})`,
      ).run(...groupIds);
      db.prepare(`DELETE FROM groups WHERE id IN (${placeholders})`).run(
        ...groupIds,
      );
      return groupIds.length;
    });
    if (!deleteGradeGroups())
      return response.status(404).json({ error: "لا توجد مجموعات لهذا الصف" });
    response.json({ ok: true });
  },
);

router.get("/api/students", authenticate, (request, response) => {
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

router.post("/api/students", authenticate, (request, response) => {
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

router.post(
  "/api/students/import",
  authenticate,
  requireAdmin,
  importStudents,
);

router.get(
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

router.put(
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

router.post(
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

router.delete(
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

router.get(
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

router.put(
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

export default router;
