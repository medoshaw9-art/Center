import { db } from '../config/database.js';

export function findActiveUserByUsername(username) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.password_hash, u.role, u.teacher_id, t.name
       FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id
       WHERE u.username = ? AND u.active = 1`,
    )
    .get(username);
}

export function findUserById(id) {
  return db
    .prepare(
      `SELECT u.id, u.username, u.role, u.teacher_id, t.name
       FROM users u LEFT JOIN teachers t ON t.id = u.teacher_id
       WHERE u.id = ?`,
    )
    .get(id);
}
