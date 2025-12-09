'use client';

import { useState } from 'react';
import { login, register, saveUser, type User } from '@/lib/authUtils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // 登录
        const user = login(username, password);
        onLoginSuccess(user);
        handleClose();
      } else {
        // 注册
        if (!nickname.trim()) {
          setError('请输入昵称');
          setIsLoading(false);
          return;
        }
        const user = register(username, password, nickname);
        saveUser(user);
        onLoginSuccess(user);
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setNickname('');
    setError('');
    setIsLoginMode(true);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 transform transition-all">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent">
              {isLoginMode ? '🔐 登录' : '✨ 注册'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  昵称
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-400"
                  placeholder="请输入昵称"
                  required={!isLoginMode}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-400"
                placeholder="请输入用户名"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-200 rounded-xl focus:outline-none focus:border-purple-400"
                placeholder="请输入密码"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 text-white font-bold hover:from-purple-600 hover:via-pink-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '处理中...' : (isLoginMode ? '登录' : '注册')}
            </button>
          </form>

          {/* 切换登录/注册 */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
              }}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              {isLoginMode ? '还没有账号？立即注册' : '已有账号？立即登录'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

