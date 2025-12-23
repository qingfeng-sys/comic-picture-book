'use client';

import { useState, useEffect } from 'react';
import { ChatMessage, StoryboardData, Script } from '@/types';
import ChatInterface from '../ChatInterface/ChatInterface';
import { 
  Sparkles, 
  FileText, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Layout, 
  MessageSquare,
  History,
  Wand2,
  Trash2,
  ChevronRight,
  ChevronLeft,
  PenTool,
  Clock
} from 'lucide-react';

interface ScriptGeneratorProps {
  onScriptComplete: (script: string, title: string, scriptId?: string) => void;
  onCancel: () => void;
  initialScript?: Script | null;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

export default function ScriptGenerator({ onScriptComplete, onCancel, initialScript, onGeneratingChange }: ScriptGeneratorProps) {
  const [title, setTitle] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  const [currentScript, setCurrentScript] = useState('');
  const [currentStoryboard, setCurrentStoryboard] = useState<StoryboardData | null>(null);
  const [outputFormat, setOutputFormat] = useState<'script' | 'storyboard'>('storyboard'); // 默认生成分镜

  // 如果是编辑模式，预填充数据
  useEffect(() => {
    if (initialScript) {
      setTitle(initialScript.title);
      setCurrentScript(initialScript.content);
    }
  }, [initialScript]);

  // 组件卸载时清理生成状态
  useEffect(() => {
    return () => {
      if (isGenerating) {
        console.warn('[组件卸载] ScriptGenerator 在生成过程中被卸载');
        onGeneratingChange?.(false);
      }
    };
  }, [isGenerating, onGeneratingChange]);

  const handleInitialGenerate = async () => {
    if (!initialPrompt.trim()) {
      alert('请输入故事描述');
      return;
    }

    console.log('开始生成脚本，当前状态:', { isGenerating, currentScript: currentScript ? '有内容' : '无内容' });
    setIsGenerating(true);
    onGeneratingChange?.(true); // 通知父组件生成开始
    
    try {
      console.log('发送API请求...');
      const response = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: initialPrompt,
          outputFormat: outputFormat, // 传递输出格式
        }),
      });

      console.log('收到API响应');
      const result = await response.json();
      console.log('API响应结果:', result.success ? '成功' : '失败');

      if (result.success) {
        if (outputFormat === 'storyboard' && result.data?.storyboard) {
          // 处理分镜数据（新格式：StoryboardData包含frames字段）
          const storyboardData: StoryboardData = result.data.storyboard;
          setCurrentStoryboard(storyboardData);
          // 将分镜转换为文本格式用于显示和保存
          const scriptText = storyboardData.frames.map(frame => {
            let text = `第${frame.frame_id}帧：\n`;
            text += `[场景：${frame.image_prompt}]\n`;
            if (frame.dialogues && frame.dialogues.length > 0) {
              frame.dialogues.forEach(dialogue => {
                text += `${dialogue.role}："${dialogue.text}" (位置: ${dialogue.anchor}, ${dialogue.x_ratio.toFixed(2)}, ${dialogue.y_ratio.toFixed(2)})\n`;
              });
            }
            if (frame.narration) {
              text += `旁白：${frame.narration}\n`;
            }
            return text;
          }).join('\n\n');
          setCurrentScript(scriptText);
          setConversationHistory([
            { role: 'user', content: initialPrompt, timestamp: new Date().toISOString() },
            { role: 'assistant', content: `已生成${storyboardData.frames.length}个分镜帧`, timestamp: new Date().toISOString() },
          ]);
        } else if (result.data?.script) {
          // 处理传统脚本格式
          const script = result.data.script;
          setCurrentScript(script);
          setCurrentStoryboard(null);
          setConversationHistory([
            { role: 'user', content: initialPrompt, timestamp: new Date().toISOString() },
            { role: 'assistant', content: script, timestamp: new Date().toISOString() },
          ]);
        } else {
          alert(result.error || '生成失败：未返回有效数据');
        }
      } else {
        alert(result.error || '生成失败');
      }
    } catch (error) {
      console.error('生成脚本失败:', error);
      alert('生成失败，请检查网络连接');
    } finally {
      setIsGenerating(false);
      onGeneratingChange?.(false); // 通知父组件生成结束
    }
  };

  const handleChatMessage = async (message: string) => {
    if (isChatting) return; // 防止重复提交

    const newUserMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    // 先更新UI，显示用户消息
    const updatedHistory = [...conversationHistory, newUserMessage];
    setConversationHistory(updatedHistory);
    setIsChatting(true);

    try {
      const response = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          conversationHistory: updatedHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          outputFormat: outputFormat, // 传递输出格式
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (outputFormat === 'storyboard' && result.data?.storyboard) {
          // 处理分镜数据（新格式：StoryboardData包含frames字段）
          const storyboardData: StoryboardData = result.data.storyboard;
          setCurrentStoryboard(storyboardData);
          const scriptText = storyboardData.frames.map(frame => {
            let text = `第${frame.frame_id}帧：\n`;
            text += `[场景：${frame.image_prompt}]\n`;
            if (frame.dialogues && frame.dialogues.length > 0) {
              frame.dialogues.forEach(dialogue => {
                text += `${dialogue.role}："${dialogue.text}" (位置: ${dialogue.anchor}, ${dialogue.x_ratio.toFixed(2)}, ${dialogue.y_ratio.toFixed(2)})\n`;
              });
            }
            if (frame.narration) {
              text += `旁白：${frame.narration}\n`;
            }
            return text;
          }).join('\n\n');
          setCurrentScript(scriptText);
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: `已更新为${storyboardData.frames.length}个分镜帧`,
            timestamp: new Date().toISOString(),
          };
          setConversationHistory(prev => [...prev, assistantMessage]);
        } else if (result.data?.script) {
          // 处理传统脚本格式
          const script = result.data.script;
          setCurrentScript(script);
          setCurrentStoryboard(null);
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: script,
            timestamp: new Date().toISOString(),
          };
          setConversationHistory(prev => [...prev, assistantMessage]);
        } else {
          alert(result.error || '生成失败：未返回有效数据');
          setConversationHistory(conversationHistory);
        }
      } else {
        alert(result.error || '生成失败');
        // 如果失败，移除用户消息，让用户可以重试
        setConversationHistory(conversationHistory);
      }
    } catch (error) {
      console.error('对话失败:', error);
      alert('对话失败，请检查网络连接');
      // 如果失败，移除用户消息，让用户可以重试
      setConversationHistory(conversationHistory);
    } finally {
      setIsChatting(false);
      // 注意：对话过程中不改变 isGenerating 状态，因为对话不是主要生成流程
    }
  };

  const handleConfirm = () => {
    if (!currentScript.trim()) {
      alert('请先生成脚本');
      return;
    }
    const finalTitle = title.trim() || `故事脚本_${new Date().toLocaleDateString()}`;
    
    // 如果有分镜数据，将分镜数据也保存到脚本中（JSON格式）
    let scriptToSave = currentScript;
    if (currentStoryboard) {
      // 在脚本末尾添加分镜数据的JSON表示（用于后续处理）
      scriptToSave += '\n\n=== 分镜数据（JSON）===\n' + JSON.stringify(currentStoryboard, null, 2);
    }
    
    onScriptComplete(scriptToSave, finalTitle, initialScript?.id);
  };

  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-primary-500/5 p-8 md:p-10 border border-slate-100 max-w-4xl mx-auto">
      <div className="flex items-center space-x-4 mb-10">
        <div className="p-3 bg-primary-50 rounded-2xl text-primary-600 shadow-sm shadow-primary-100">
          <Sparkles size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
            {initialScript ? '编辑故事脚本' : '生成故事脚本'}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Script Forge Pipeline</p>
        </div>
      </div>

      {!currentScript ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="flex items-center space-x-2 text-xs font-black text-slate-500 uppercase tracking-wider ml-1">
                <FileText size={14} className="text-primary-500" />
                <span>脚本标题（建议填写）</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：小兔子的冒险"
                className="input-field !rounded-2xl"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center space-x-2 text-xs font-black text-slate-500 uppercase tracking-wider ml-1">
                <Layout size={14} className="text-primary-500" />
                <span>输出格式选择</span>
              </label>
              <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-100">
                <button
                  onClick={() => setOutputFormat('storyboard')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                    outputFormat === 'storyboard' 
                      ? 'bg-white text-primary-600 shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  结构化分镜
                </button>
                <button
                  onClick={() => setOutputFormat('script')}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                    outputFormat === 'script' 
                      ? 'bg-white text-primary-600 shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  传统文本
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-xs font-black text-slate-500 uppercase tracking-wider ml-1">
              <MessageSquare size={14} className="text-primary-500" />
              <span>灵感描述 (Inspiration)</span>
            </label>
            <textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              placeholder="描述你想要的故事，可以是详细的情节，也可以只是一个主题。例如：一个小兔子想要去森林探险，遇到了各种有趣的朋友..."
              rows={6}
              className="textarea-field !rounded-[2rem]"
            />
          </div>

          <div className="flex gap-4 pt-2">
            <button
              onClick={handleInitialGenerate}
              disabled={isGenerating}
              className="flex-1 btn-primary !py-4 !rounded-2xl flex items-center justify-center space-x-3 text-lg group shadow-xl shadow-primary-200"
            >
              {isGenerating ? (
                <>
                  <Clock size={24} className="animate-spin" />
                  <span>正在构思情节...</span>
                </>
              ) : (
                <>
                  <Wand2 size={24} className="group-hover:rotate-12 transition-transform" />
                  <span>开始生成脚本</span>
                </>
              )}
            </button>
            <button 
              onClick={onCancel} 
              className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all flex items-center space-x-2 active:scale-95"
            >
              <XCircle size={20} />
              <span>取消</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              <FileText size={12} className="text-primary-500" />
              <span>脚本标题 (Title)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入脚本标题"
              className="input-field !rounded-xl !py-2.5 !text-base font-bold"
            />
          </div>

          <div className="space-y-3">
            <label className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
              <History size={12} className="text-primary-500" />
              <span>{initialScript ? '脚本编辑 (Edit Content)' : '脚本预览 (Preview)'}</span>
            </label>
            {initialScript ? (
              <textarea
                value={currentScript}
                onChange={(e) => setCurrentScript(e.target.value)}
                className="textarea-field !rounded-3xl !bg-slate-50/30 !border-slate-100 max-h-[400px] overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed"
                rows={12}
              />
            ) : (
              <div className="textarea-field !rounded-3xl !bg-slate-50/30 !border-slate-100 max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-600 p-6 shadow-inner">
                {currentScript}
              </div>
            )}
          </div>

          <div className="bg-primary-50/30 rounded-[2rem] p-6 border border-primary-100/50">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-primary-100 text-primary-600 rounded-xl shadow-sm">
                <MessageSquare size={18} />
              </div>
              <h3 className="text-sm font-black text-primary-800 uppercase tracking-wider">对话反馈优化</h3>
            </div>
            <ChatInterface
              messages={conversationHistory}
              onSendMessage={handleChatMessage}
              disabled={isChatting}
              isLoading={isChatting}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={handleConfirm} 
              className="flex-1 btn-primary !py-4 !rounded-2xl flex items-center justify-center space-x-3 text-lg font-black shadow-xl shadow-primary-200"
            >
              <CheckCircle2 size={24} />
              <span>确认并保存脚本</span>
            </button>
            <button 
              onClick={onCancel} 
              className="px-8 py-4 rounded-2xl border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all flex items-center space-x-2 active:scale-95"
            >
              <XCircle size={20} />
              <span>取消</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

