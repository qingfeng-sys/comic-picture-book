'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types';

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
    <div className="flex flex-col h-96 border border-gray-300 rounded-lg bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>开始对话来完善你的脚本</p>
            <p className="text-sm mt-2">例如："让故事更有趣一些"、"增加一个角色"等</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                <span>正在思考...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-300 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的想法..."
            disabled={disabled}
            className="input-field flex-1 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </form>
    </div>
  );
}

