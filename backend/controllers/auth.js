import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../middleware/auth.js';
import { findActiveUserByUsername, findUserById } from '../models/users.js';

export function login(request, response) {
  const { username, password } = request.body || {};
  const user = findActiveUserByUsername(String(username || '').trim());
  if (
    !user ||
    user.role !== 'admin' ||
    !bcrypt.compareSync(String(password || ''), user.password_hash)
  ) {
    return response
      .status(401)
      .json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '12h' });
  response.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      teacherId: user.teacher_id,
      name: user.name || 'مدير السنتر',
    },
  });
}

export function getCurrentUser(request, response) {
  const user = findUserById(request.user.id);
  response.json({
    id: user.id,
    username: user.username,
    role: user.role,
    teacherId: user.teacher_id,
    name: user.name || 'مدير السنتر',
  });
}
