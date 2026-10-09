import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';

export const jwtSecret =
  process.env.JWT_SECRET || "development-only-change-before-deploying";
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("Set JWT_SECRET before starting in production");
}

export function authenticate(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "يلزم تسجيل الدخول" });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = db
      .prepare(
        "SELECT id, username, role, teacher_id, active FROM users WHERE id = ?",
      )
      .get(payload.id);
    if (!user || !user.active)
      return response.status(401).json({ error: "يلزم تسجيل الدخول" });
    request.user = user;
    next();
  } catch {
    response
      .status(401)
      .json({ error: "انتهت جلسة الدخول، سجل الدخول مجددًا" });
  }
}

export function requireAdmin(request, response, next) {
  if (request.user.role !== "admin")
    return response.status(403).json({ error: "هذه العملية متاحة للمدير فقط" });
  next();
}

export function canAccessGroup(user, groupId) {
  if (!user || !Number.isInteger(Number(groupId))) return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher" || !user.teacher_id) return false;
  return Boolean(
    db
      .prepare(
        "SELECT 1 FROM groups WHERE id = ? AND teacher_id = ? AND active = 1",
      )
      .get(Number(groupId), user.teacher_id),
  );
}

export function canAccessStudent(user, studentId) {
  if (!user || !Number.isInteger(Number(studentId))) return false;
  if (user.role === "admin") return true;
  if (user.role !== "teacher" || !user.teacher_id) return false;
  return Boolean(
    db
      .prepare(
        `
    SELECT 1 FROM enrollments e JOIN groups g ON g.id = e.group_id
    WHERE e.student_id = ? AND e.active = 1 AND g.teacher_id = ? AND g.active = 1
  `,
      )
      .get(Number(studentId), user.teacher_id),
  );
}

export function requireGroupAccess(request, response, next) {
  const id = Number(request.params.groupId || request.params.id);
  if (!canAccessGroup(request.user, id))
    return response.status(404).json({ error: "المجموعة غير موجودة" });
  next();
}

export function requireStudentAccess(request, response, next) {
  if (!canAccessStudent(request.user, Number(request.params.id)))
    return response.status(404).json({ error: "الطالب غير موجود" });
  next();
}
