'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { X, Lock, User as UserIcon, Smile, Loader2, Sparkles } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
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
        const result = await signIn('credentials', {
          redirect: false,
          username,
          password,
        });

        if (result?.error) {
          setError(result.error);
        } else {
          onLoginSuccess({ username }); // 触发成功回调
          handleClose();
        }
      } else {
        // 注册
        if (!nickname.trim()) {
          setError('请输入昵称');
          setIsLoading(false);
          return;
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, nickname }),
        });

        const data = await res.json();

        if (data.success) {
          // 注册成功后直接登录
          const loginResult = await signIn('credentials', {
            redirect: false,
            username,
            password,
          });

          if (loginResult?.error) {
            setError(loginResult.error);
          } else {
            onLoginSuccess(data.data);
            handleClose();
          }
        } else {
          setError(data.error || '注册失败');
        }
      }
    } catch (err: any) {
      setError('操作失败，请重试');
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="relative p-8 md:p-10">
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary-50 rounded-full blur-3xl opacity-50"></div>
          
          {/* 头部 */}
          <div className="relative z-10 flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                {isLoginMode ? '欢迎回来' : '开启创作'}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">
                {isLoginMode ? 'Sign in to your account' : 'Create your workshop ID'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
            {!isLoginMode && (
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                  创作昵称 (Nickname)
                </label>
                <div className="relative group">
                  <Smile size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="input-field !pl-12"
                    placeholder="给自己起个好听的名字"
                    required={!isLoginMode}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                通行账号 (Username)
              </label>
              <div className="relative group">
                <UserIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field !pl-12"
                  placeholder="输入您的登录账号"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                安全密码 (Password)
              </label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field !pl-12"
                  placeholder="保护您的创作成果"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-in shake-1 duration-300">
                <div className="text-red-500 mt-0.5">
                  <Lock size={14} />
                </div>
                <p className="text-red-600 text-xs font-bold leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full !py-4 !rounded-2xl flex items-center justify-center gap-3 text-base shadow-xl shadow-primary-200"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>正在处理中...</span>
                </>
              ) : (
                <>
                  {isLoginMode ? <Lock size={20} /> : <Sparkles size={20} />}
                  <span>{isLoginMode ? '立即登录' : '创建账号'}</span>
                </>
              )}
            </button>
          </form>

          {/* 切换登录/注册 */}
          <div className="relative z-10 mt-8 text-center">
            <button
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
              }}
              className="text-sm font-bold text-slate-400 hover:text-primary-600 transition-colors"
            >
              {isLoginMode ? '还没有账号？ ' : '已有通行账号？ '}
              <span className="text-primary-500 underline underline-offset-4 decoration-2 decoration-primary-100">
                {isLoginMode ? '立即加入工坊' : '点此返回登录'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

