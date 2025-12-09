/**
 * 用户认证工具函数
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  nickname: string;
  avatar?: string;
  isVip: boolean;
  createdAt: string;
}

/**
 * 从本地存储获取当前用户
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const userStr = localStorage.getItem('current_user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
}

/**
 * 保存用户信息到本地存储
 */
export function saveUser(user: User): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('current_user', JSON.stringify(user));
    localStorage.setItem('is_logged_in', 'true');
  } catch (error) {
    console.error('保存用户信息失败:', error);
  }
}

/**
 * 检查用户是否已登录
 */
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isLoggedIn = localStorage.getItem('is_logged_in');
  return isLoggedIn === 'true' && getCurrentUser() !== null;
}

/**
 * 用户登出
 */
export function logout(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('current_user');
  localStorage.removeItem('is_logged_in');
}

/**
 * 注册新用户
 */
export function register(username: string, password: string, nickname?: string): User {
  // 检查用户名是否已存在
  const users = getAllUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('用户名已存在');
  }
  
  const newUser: User = {
    id: `user_${Date.now()}`,
    username,
    nickname: nickname || username,
    isVip: false,
    createdAt: new Date().toISOString(),
  };
  
  // 保存用户到用户列表（实际应用中应该保存到服务器）
  users.push(newUser);
  localStorage.setItem('users', JSON.stringify(users));
  
  // 保存密码（实际应用中应该加密存储）
  const passwords: Record<string, string> = JSON.parse(localStorage.getItem('user_passwords') || '{}');
  passwords[username] = password;
  localStorage.setItem('user_passwords', JSON.stringify(passwords));
  
  return newUser;
}

/**
 * 用户登录
 */
export function login(username: string, password: string): User {
  const users = getAllUsers();
  const user = users.find(u => u.username === username);
  
  if (!user) {
    throw new Error('用户名不存在');
  }
  
  // 验证密码（实际应用中应该使用加密验证）
  const passwords: Record<string, string> = JSON.parse(localStorage.getItem('user_passwords') || '{}');
  if (passwords[username] !== password) {
    throw new Error('密码错误');
  }
  
  saveUser(user);
  return user;
}

/**
 * 获取所有用户（用于注册时检查用户名是否已存在）
 */
function getAllUsers(): User[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const usersStr = localStorage.getItem('users');
    return usersStr ? JSON.parse(usersStr) : [];
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
}
