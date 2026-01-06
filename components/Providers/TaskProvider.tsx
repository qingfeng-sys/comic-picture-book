'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Script, ComicBook, StoryboardData, CharacterProfile, ComicPage } from '@/types';
import { extractStoryboardFromScript, saveComicBookToStorage, saveScriptToStorage } from '@/lib/scriptUtils';

export type TaskType = 'script' | 'comic' | 'character';
export type TaskStatus = 'pending' | 'generating' | 'completed' | 'error';

export interface TaskLog {
  type: 'info' | 'success' | 'error';
  message: string;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  result?: any;
  error?: string;
  params: any;
  logs: TaskLog[];
  startTime: number;
  endTime?: number;
}

interface TaskContextType {
  tasks: Record<string, Task>;
  startScriptTask: (params: {
    prompt: string;
    title?: string;
    outputFormat: 'script' | 'storyboard';
    characterProfiles?: CharacterProfile[];
    conversationHistory?: any[];
  }) => Promise<string>;
  startComicTask: (params: {
    selectedScript: Script;
    selectedSegmentId: number;
    generationModel: string;
    characterReferencesToSend?: any;
    referenceImagesToSend?: string[];
  }) => Promise<string>;
  startCharacterTask: (params: {
    prompt: string;
    model: string;
    selectedScriptId?: string;
    selectedScriptTitle?: string;
  }) => Promise<string>;
  getTask: (id: string) => Task | undefined;
  removeTask: (id: string) => void;
  clearCompletedTasks: () => void;
  isAnyTaskGenerating: boolean;
  notifications: string[];
  removeNotification: (index: number) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Record<string, Task>>({});
  const [notifications, setNotifications] = useState<string[]>([]);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const addNotification = useCallback((msg: string) => {
    setNotifications(prev => [...prev, msg]);
  }, []);

  const removeNotification = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task> | ((prev: Task) => Partial<Task>)) => {
    setTasks(prev => {
      const currentTask = prev[id];
      if (!currentTask) return prev;
      
      const nextUpdates = typeof updates === 'function' ? updates(currentTask) : updates;
      const updatedTask = { ...currentTask, ...nextUpdates };
      
      return {
        ...prev,
        [id]: updatedTask
      };
    });
  }, []);

  const addLog = useCallback((id: string, log: TaskLog) => {
    setTasks(prev => {
      const currentTask = prev[id];
      if (!currentTask) return prev;
      return {
        ...prev,
        [id]: {
          ...currentTask,
          logs: [...currentTask.logs, log]
        }
      };
    });
  }, []);

  // 1. 脚本生成任务
  const startScriptTask = useCallback(async (params: {
    prompt: string;
    title?: string;
    outputFormat: 'script' | 'storyboard';
    characterProfiles?: CharacterProfile[];
    conversationHistory?: any[];
  }) => {
    const taskId = `script-${Date.now()}`;
    const newTask: Task = {
      id: taskId,
      type: 'script',
      status: 'generating',
      progress: 0,
      params,
      logs: [{ type: 'info', message: '🚀 开始构思故事脚本...' }],
      startTime: Date.now(),
    };

    setTasks(prev => ({ ...prev, [taskId]: newTask }));

    try {
      const response = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: params.prompt,
          outputFormat: params.outputFormat,
          characterProfiles: params.characterProfiles?.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            description: p.description,
            visual: p.visual
          })),
          conversationHistory: params.conversationHistory
        }),
      });

      const result = await response.json();

      if (result.success) {
        addLog(taskId, { type: 'success', message: '✅ 脚本生成成功' });
        
        // --- 核心逻辑：在后台自动持久化保存结果 ---
        const resultData = result.data;
        let scriptText = '';
        let storyboardObj: StoryboardData | undefined;

        if (params.outputFormat === 'storyboard' && resultData.storyboard) {
          storyboardObj = resultData.storyboard;
          scriptText = storyboardObj!.frames.map(frame => {
            let text = `第${frame.frame_id}帧：\n[场景：${frame.image_prompt}]\n`;
            frame.dialogues?.forEach(d => { text += `${d.role}："${d.text}"\n`; });
            if (frame.narration) text += `旁白：${frame.narration}\n`;
            return text;
          }).join('\n\n');
          scriptText += '\n\n=== 分镜数据（JSON）===\n' + JSON.stringify(storyboardObj, null, 2);
        } else {
          scriptText = resultData.script;
        }

        const scriptTitle = params.title || `故事脚本_${new Date().toLocaleDateString()}`;
        await saveScriptToStorage({
          title: scriptTitle,
          content: scriptText,
        });
        
        addNotification(`脚本《${scriptTitle}》已成功生成并保存！`);
        // ---------------------------------------

        updateTask(taskId, {
          status: 'completed',
          progress: 100,
          result: resultData,
          endTime: Date.now()
        });
      } else {
        const errorMsg = result.error || '生成失败';
        addLog(taskId, { type: 'error', message: `❌ 生成失败: ${errorMsg}` });
        updateTask(taskId, { status: 'error', error: errorMsg, endTime: Date.now() });
      }
    } catch (error: any) {
      const errorMsg = error.message || '网络请求失败';
      addLog(taskId, { type: 'error', message: `❌ 发生错误: ${errorMsg}` });
      updateTask(taskId, { status: 'error', error: errorMsg, endTime: Date.now() });
    }

    return taskId;
  }, [updateTask, addLog, addNotification]);

  // 2. 绘本生成任务
  const startComicTask = useCallback(async (params: {
    selectedScript: Script;
    selectedSegmentId: number;
    generationModel: string;
    characterReferencesToSend?: any;
    referenceImagesToSend?: string[];
  }) => {
    const { selectedScript, selectedSegmentId, generationModel, characterReferencesToSend, referenceImagesToSend } = params;
    const taskId = `comic-${Date.now()}`;
    
    const newTask: Task = {
      id: taskId,
      type: 'comic',
      status: 'generating',
      progress: 0,
      params,
      logs: [{ type: 'info', message: '🚀 准备开始生成绘本...' }],
      startTime: Date.now(),
    };

    setTasks(prev => ({ ...prev, [taskId]: newTask }));

    try {
      const storyboardData = extractStoryboardFromScript(selectedScript.content);
      const allPages: ComicPage[] = [];
      
      if (storyboardData) {
        const startFrameIndex = (selectedSegmentId - 1) * 10;
        const segmentFrames = storyboardData.frames.slice(startFrameIndex, startFrameIndex + 10);
        
        if (segmentFrames.length === 0) throw new Error('该片段没有对应的分镜数据');

        addLog(taskId, { type: 'info', message: `检测到分镜数据，共 ${segmentFrames.length} 页，准备逐页生成...` });

        for (let i = 0; i < segmentFrames.length; i++) {
          const frame = segmentFrames[i];
          const pageNumber = (selectedSegmentId - 1) * 10 + i + 1;
          addLog(taskId, { type: 'info', message: `正在生成第 ${pageNumber} 页...` });

          const response = await fetch('/api/comic/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              storyboard: { frames: [frame] },
              startPageNumber: pageNumber,
              scriptId: selectedScript.id,
              segmentId: selectedSegmentId,
              model: generationModel,
              characterReferences: characterReferencesToSend,
              referenceImages: referenceImagesToSend,
            }),
          });

          const result = await response.json();
          if (result.success && result.data?.pages?.length > 0) {
            allPages.push(result.data.pages[0]);
            const progress = Math.round(((i + 1) / segmentFrames.length) * 100);
            updateTask(taskId, { progress, result: [...allPages] });
            addLog(taskId, { type: 'success', message: `✅ 第 ${pageNumber} 页生成成功` });
          } else {
            addLog(taskId, { type: 'error', message: `❌ 第 ${pageNumber} 页生成失败` });
          }
        }
      } else {
        // 退化处理
        addLog(taskId, { type: 'info', message: '未检测到结构化分镜，使用传统模式一次性生成...' });
        const response = await fetch('/api/comic/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptSegment: selectedScript.content,
            startPageNumber: (selectedSegmentId - 1) * 10 + 1,
            scriptId: selectedScript.id,
            segmentId: selectedSegmentId,
            model: generationModel,
            characterReferences: characterReferencesToSend,
            referenceImages: referenceImagesToSend,
          }),
        });
        const result = await response.json();
        if (result.success && result.data?.pages) {
          allPages.push(...result.data.pages);
          updateTask(taskId, { progress: 100, result: allPages });
        } else {
          throw new Error(result.error || '生成失败');
        }
      }

      if (allPages.length > 0) {
        await saveComicBookToStorage({
          scriptId: selectedScript.id,
          segmentId: selectedSegmentId,
          title: selectedScript.title,
          pages: allPages,
        });
        addLog(taskId, { type: 'success', message: '🎉 绘本已完整保存至数据库' });
        addNotification(`绘本《${selectedScript.title}》已完成渲染！`);
        updateTask(taskId, { status: 'completed', endTime: Date.now() });
      } else {
        updateTask(taskId, { status: 'error', error: '未能生成任何页面', endTime: Date.now() });
      }
    } catch (error: any) {
      addLog(taskId, { type: 'error', message: `🔥 错误: ${error.message}` });
      updateTask(taskId, { status: 'error', error: error.message, endTime: Date.now() });
    }

    return taskId;
  }, [updateTask, addLog, addNotification]);

  // 3. 角色生成任务
  const startCharacterTask = useCallback(async (params: {
    prompt: string;
    model: string;
    selectedScriptId?: string;
    selectedScriptTitle?: string;
  }) => {
    const taskId = `character-${Date.now()}`;
    const newTask: Task = {
      id: taskId,
      type: 'character',
      status: 'generating',
      progress: 0,
      params,
      logs: [{ type: 'info', message: '🚀 正在分析并绘制角色形象...' }],
      startTime: Date.now(),
    };

    setTasks(prev => ({ ...prev, [taskId]: newTask }));

    try {
      const response = await fetch('/api/character/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: params.prompt, model: params.model }),
      });

      const result = await response.json();
      if (result.success && Array.isArray(result.data?.characters)) {
        addLog(taskId, { type: 'success', message: `✅ 角色立绘生成成功` });
        addNotification(`脚本相关角色的立绘已绘制完成！`);
        updateTask(taskId, { status: 'completed', progress: 100, result: result.data.characters, endTime: Date.now() });
      } else {
        updateTask(taskId, { status: 'error', error: result.error || '生成失败', endTime: Date.now() });
      }
    } catch (error: any) {
      updateTask(taskId, { status: 'error', error: error.message, endTime: Date.now() });
    }

    return taskId;
  }, [updateTask, addLog, addNotification]);

  const getTask = useCallback((id: string) => tasksRef.current[id], []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => {
      const newTasks = { ...prev };
      delete newTasks[id];
      return newTasks;
    });
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setTasks(prev => {
      const nextTasks = { ...prev };
      Object.keys(nextTasks).forEach(id => {
        if (nextTasks[id].status === 'completed' || nextTasks[id].status === 'error') {
          delete nextTasks[id];
        }
      });
      return nextTasks;
    });
  }, []);

  const isAnyTaskGenerating = Object.values(tasks).some(t => t.status === 'generating');

  return (
    <TaskContext.Provider value={{ 
      tasks, 
      startScriptTask, 
      startComicTask, 
      startCharacterTask,
      getTask, 
      removeTask,
      clearCompletedTasks,
      isAnyTaskGenerating,
      notifications,
      removeNotification
    }}>
      {children}
    </TaskContext.Provider>
  );
};
