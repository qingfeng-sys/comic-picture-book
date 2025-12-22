'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';
import { Send, User, Sparkles, Loader2, MessageSquare } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export default function ChatInterface({ messages, onSendMessage, disabled = false, isLoading = false }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-[450px] border border-slate-200 rounded-[2rem] bg-white overflow-hidden shadow-sm">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
            <div className="p-4 bg-slate-50 rounded-full">
              <MessageSquare size={48} className="text-slate-300" />
            </div>
            <div>
              <p className="font-black text-slate-500 uppercase tracking-widest text-xs">Awaiting Input</p>
              <p className="text-sm font-medium mt-1">开始对话来完善你的脚本</p>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>
              <div
                className={`max-w-[80%] rounded-[1.25rem] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white !rounded-tr-none'
                    : 'bg-slate-50 text-slate-700 border border-slate-100 !rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center animate-pulse">
              <Sparkles size={16} />
            </div>
            <div className="bg-slate-50 text-slate-400 rounded-[1.25rem] !rounded-tl-none px-4 py-3 border border-slate-100 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-slate-50/50 border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="提出修改建议或新要求..."
            disabled={disabled}
            className="input-field !rounded-xl !bg-white !py-2.5 !text-sm flex-1 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="btn-primary !p-3 !rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-primary-200"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

