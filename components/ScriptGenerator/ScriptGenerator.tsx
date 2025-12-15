'use client';

import { useState, useEffect } from 'react';
import { ChatMessage, StoryboardData, Script, CharacterProfile } from '@/types';
import ChatInterface from '../ChatInterface/ChatInterface';
import { upsertCharacter } from '@/lib/characterUtils';

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
  const [isAutoGeneratingCharacters, setIsAutoGeneratingCharacters] = useState(false);

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

          // 自动生成角色参考图（用户无需手动维护角色库）
          setIsAutoGeneratingCharacters(true);
          try {
            const charRes = await fetch('/api/character/auto-generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: initialPrompt }),
            });
            const charJson = await charRes.json();
            if (charJson.success && Array.isArray(charJson.data?.characters)) {
              const chars: CharacterProfile[] = charJson.data.characters;
              chars.forEach((c) => upsertCharacter(c));
              // 在对话区提示用户（不打扰）
              setConversationHistory((prev) => [
                ...prev,
                {
                  role: 'assistant',
                  content: `已自动生成角色参考图：${chars.filter(c => !!c.referenceImageUrl).length}/${chars.length}（可用于提升跨帧一致性）`,
                  timestamp: new Date().toISOString(),
                },
              ]);
            }
          } catch (e) {
            console.warn('自动生成角色参考图失败（可忽略）:', e);
          } finally {
            setIsAutoGeneratingCharacters(false);
          }
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
    <div className="card max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">{initialScript ? '编辑故事脚本' : '生成故事脚本'}</h2>

      {!currentScript ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              脚本标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：小兔子的冒险"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              输出格式
            </label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="storyboard"
                  checked={outputFormat === 'storyboard'}
                  onChange={(e) => setOutputFormat(e.target.value as 'script' | 'storyboard')}
                  className="mr-2"
                />
                <span>结构化分镜（推荐）</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="script"
                  checked={outputFormat === 'script'}
                  onChange={(e) => setOutputFormat(e.target.value as 'script' | 'storyboard')}
                  className="mr-2"
                />
                <span>传统文本脚本</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              故事描述
            </label>
            <textarea
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              placeholder="描述你想要的故事，可以是详细的情节，也可以只是一个主题。例如：一个小兔子想要去森林探险，遇到了各种有趣的朋友..."
              rows={6}
              className="textarea-field"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleInitialGenerate}
              disabled={isGenerating}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? '生成中...' : '生成脚本'}
            </button>
            <button onClick={onCancel} className="btn-secondary">
              取消
            </button>
          </div>
          {isAutoGeneratingCharacters && (
            <p className="text-xs text-gray-500 mt-2">
              正在自动生成角色参考图（用于提升跨帧一致性）...
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              脚本标题
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入脚本标题"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {initialScript ? '脚本内容（可编辑）' : '当前脚本预览'}
            </label>
            {initialScript ? (
              <textarea
                value={currentScript}
                onChange={(e) => setCurrentScript(e.target.value)}
                className="textarea-field bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap"
                rows={10}
              />
            ) : (
              <div className="textarea-field bg-gray-50 max-h-60 overflow-y-auto whitespace-pre-wrap">
                {currentScript}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">继续完善脚本</h3>
            <ChatInterface
              messages={conversationHistory}
              onSendMessage={handleChatMessage}
              disabled={isChatting}
              isLoading={isChatting}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button onClick={handleConfirm} className="btn-primary flex-1">
              确认并保存脚本
            </button>
            <button onClick={onCancel} className="btn-secondary">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

