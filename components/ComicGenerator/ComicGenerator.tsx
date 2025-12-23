'use client';

import { useState, useEffect, useMemo } from 'react';
import { Script, ScriptWithSegments, ComicPage, StoryboardData, ComicBook, GenerationModel, CharacterProfile } from '@/types';
import {
  createScriptWithSegments,
  loadScriptsFromStorage,
  importScriptFromText,
  extractStoryboardFromScript,
  saveComicBookToStorage,
  splitScriptIntoSegments,
} from '@/lib/scriptUtils';
import ComicPageCanvas from '@/components/ComicPageCanvas/ComicPageCanvas';
import { loadCharactersFromStorage, upsertCharacter } from '@/lib/characterUtils';
import { 
  ArrowLeft, 
  Settings2, 
  Image as ImageIcon, 
  RefreshCw, 
  Users, 
  Layout, 
  Sparkles, 
  Play,
  Search,
  Plus,
  FileText,
  ChevronRight,
  UserPlus,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronLeft,
  Palette,
  Clock,
  ChevronDown,
  Loader2,
  User as UserIcon,
  Layers
} from 'lucide-react';

const MODEL_OPTIONS: Array<{
  value: GenerationModel;
  label: string;
  description: string;
  isAsync: boolean;
}> = [
  {
    value: 'wan2.6-image',
    label: '万相 wan2.6-image',
    description: '旗舰级多模态模型，支持 1-3 张参考图，极致画质与一致性',
    isAsync: true,
  },
  {
    value: 'wanx-v1',
    label: '万相 wanx-v1（支持参考图）',
    description: '异步任务，支持参考图/一致性约束（推荐）',
    isAsync: true,
  },
  {
    value: 'wan2.5-i2i-preview',
    label: '万相 wan2.5-i2i-preview',
    description: '图生图模型，强力参考图支持',
    isAsync: true,
  },
  {
    value: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image（七牛）',
    description: '同步返回，支持参考图/一致性约束，速度快',
    isAsync: false,
  },
];

// 角色立绘：使用“仅文生图”的万相模型（不包含支持参考图的 wanx-v1）
const PORTRAIT_MODELS: Array<{ value: GenerationModel; label: string }> = [
  { value: 'wan2.5-t2i-preview', label: '通义万相 V2.5 Preview（文生图）' },
  { value: 'wan2.2-t2i-plus', label: '通义万相 2.2 Plus（文生图）' },
  { value: 'wan2.2-t2i-flash', label: '通义万相 2.2 Flash（文生图）' },
  { value: 'wanx2.1-t2i-plus', label: '通义万相 X2.1 Plus（文生图）' },
  { value: 'wanx2.1-t2i-turbo', label: '通义万相 X2.1 Turbo（文生图）' },
  { value: 'wanx2.0-t2i-turbo', label: '通义万相 X2.0 Turbo（文生图）' },
];

interface ComicGeneratorProps {
  onBack: () => void;
  initialScriptId?: string | null;
}

export default function ComicGenerator({ onBack, initialScriptId }: ComicGeneratorProps) {
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptWithSegments | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [generationLogs, setGenerationLogs] = useState<Array<{ type: 'info' | 'success' | 'error', message: string }>>([]);
  const [generatedPages, setGeneratedPages] = useState<ComicPage[]>([]);
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [generationModel, setGenerationModel] = useState<GenerationModel>('wan2.5-i2i-preview');
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [useCharacterReferences, setUseCharacterReferences] = useState(true);
  const [showCharacterAdvanced, setShowCharacterAdvanced] = useState(false);
  const [showAddFromLibrary, setShowAddFromLibrary] = useState(false);
  const [addFromLibraryQuery, setAddFromLibraryQuery] = useState('');
  const [extraVisibleCharacterIds, setExtraVisibleCharacterIds] = useState<string[]>([]);
  const [userTouchedCharacterSelection, setUserTouchedCharacterSelection] = useState(false);
  const [portraitModel, setPortraitModel] = useState<GenerationModel>('wan2.2-t2i-plus');
  const [isGeneratingPortraits, setIsGeneratingPortraits] = useState(false);
  const [combinedReferenceImage, setCombinedReferenceImage] = useState<string | undefined>(undefined);

  const scriptRoleNames = useMemo(() => {
    if (!selectedScript) return null;
    return extractRoleNamesFromScript(selectedScript.content);
  }, [selectedScript]);

  // 选中脚本后：只显示该脚本涉及的角色（按 name/matchNames 匹配分镜 role）
  const visibleCharacters = useMemo(() => {
    if (!Array.isArray(characters)) return [];
    // 未选脚本：展示全量角色库
    if (!scriptRoleNames || scriptRoleNames.size === 0) return characters;

    const extraSet = new Set(extraVisibleCharacterIds);
    return characters.filter((c) => {
      // 1. 优先包含显式标记为该脚本来源的角色
      if (c.sourceScriptId === selectedScript?.id) return true;
      // 2. 包含手动选中的角色
      if (extraSet.has(c.id)) return true;
      // 3. 包含名字匹配脚本角色的角色
      const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
      return keys.some((k) => scriptRoleNames.has(String(k || '').trim()));
    });
  }, [characters, scriptRoleNames, extraVisibleCharacterIds, selectedScript?.id]);

  useEffect(() => {
    const fetchData = async () => {
      const scripts = await loadScriptsFromStorage();
      // 最新脚本排在最前：优先按 updatedAt，其次 createdAt（降序）
      const sorted = [...scripts].sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setSavedScripts(sorted);

      // 如果传入了 initialScriptId，自动选中该脚本
      if (initialScriptId) {
        const script = sorted.find(s => s.id === initialScriptId);
        if (script) {
          const segments = splitScriptIntoSegments(script.content);
          const scriptWithSegments: ScriptWithSegments = {
            ...script,
            segments,
            totalSegments: segments.length,
          };
          setSelectedScript(scriptWithSegments);
        }
      }

      const chars = await loadCharactersFromStorage();
      setCharacters(Array.isArray(chars) ? chars : []);
      // 默认全自动：自动选中所有已生成立绘的角色（用户无需手动勾选）
      if (Array.isArray(chars)) {
        setSelectedCharacterIds(chars.filter(c => !!c.referenceImageUrl).map(c => c.id));
      }
    };
    fetchData();
  }, [initialScriptId]);

  const refreshCharacters = async () => {
    const chars = await loadCharactersFromStorage();
    setCharacters(chars);
    // selectedCharacterIds 由“选中脚本后的自动筛选”逻辑接管（避免混入历史脚本的角色）
  };

  // 选中脚本后，自动勾选该脚本涉及且已生成立绘的角色
  useEffect(() => {
    if (!selectedScript || !Array.isArray(visibleCharacters)) return;
    const ids = visibleCharacters.filter((c) => !!c.referenceImageUrl).map((c) => c.id);
    if (!userTouchedCharacterSelection) {
      setSelectedCharacterIds(ids);
    }
  }, [selectedScript?.id, visibleCharacters, userTouchedCharacterSelection]);

  const characterReferences = useCharacterReferences && Array.isArray(visibleCharacters)
    ? buildCharacterReferenceMap(visibleCharacters.filter(c => selectedCharacterIds.includes(c.id)))
    : undefined;

  // 生成“多角色参考拼图”：仅用于 i2i 模型（wan2.5-i2i-preview）
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!useCharacterReferences) {
        setCombinedReferenceImage(undefined);
        return;
      }
      if (generationModel !== 'wan2.5-i2i-preview') {
        setCombinedReferenceImage(undefined);
        return;
      }
      const selected = visibleCharacters.filter(c => selectedCharacterIds.includes(c.id) && !!c.referenceImageUrl);
      const img = await buildCombinedReferenceImage(selected);
      if (!cancelled) setCombinedReferenceImage(img);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [useCharacterReferences, generationModel, visibleCharacters, selectedCharacterIds]);

  const handleGeneratePortraits = async () => {
    if (!selectedScript) {
      alert('请先选择脚本');
      return;
    }
    setIsGeneratingPortraits(true);
    try {
      // 使用“脚本内容”作为输入，让后端通过大纲/角色表推断并生成立绘
      const res = await fetch('/api/character/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: selectedScript.content,
          model: portraitModel,
        }),
      });
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data?.characters)) {
        alert(json.error || '生成角色立绘失败');
        return;
      }
      const chars: CharacterProfile[] = json.data.characters;
      // 将本次“目标脚本”的信息写入角色库，便于角色库按脚本分组展示
      for (const c of chars) {
        await upsertCharacter({
          ...c,
          sourceType: 'script',
          sourceScriptId: selectedScript.id,
          sourceScriptTitle: selectedScript.title,
          updatedAt: new Date().toISOString(),
        });
      }
      await refreshCharacters();
      alert(`角色立绘生成完成：${chars.filter((c) => !!c.referenceImageUrl).length}/${chars.length}`);
    } catch (e) {
      console.error(e);
      alert('生成失败，请检查网络连接');
    } finally {
      setIsGeneratingPortraits(false);
    }
  };

  useEffect(() => {
    if (isGenerating) {
      const el = document.getElementById('logs-end');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }, [generationLogs, isGenerating]);

  const handleScriptSelect = (script: Script) => {
    // 选择已保存脚本时：保留原始 id/时间戳，避免“选中态”无法高亮/混淆
    setExtraVisibleCharacterIds([]);
    setUserTouchedCharacterSelection(false);
    setShowAddFromLibrary(false);
    setAddFromLibraryQuery('');
    const segments = splitScriptIntoSegments(script.content);
    const scriptWithSegments: ScriptWithSegments = {
      ...script,
      segments,
      totalSegments: segments.length,
    };
    setSelectedScript(scriptWithSegments);
    setSelectedSegmentId(null);
    setGeneratedPages([]);
  };

  const handleResetScriptSelect = () => {
    setSelectedScript(null);
    setSelectedSegmentId(null);
    setGeneratedPages([]);
    setShowImport(false);
    setImportText('');
    setShowCharacterAdvanced(false);
    setShowAddFromLibrary(false);
    setAddFromLibraryQuery('');
    setExtraVisibleCharacterIds([]);
    setUserTouchedCharacterSelection(false);
  };

  const handleImportScript = () => {
    if (!importText.trim()) {
      alert('请输入脚本内容');
      return;
    }

    setExtraVisibleCharacterIds([]);
    setUserTouchedCharacterSelection(false);
    setShowAddFromLibrary(false);
    setAddFromLibraryQuery('');
    const importedScript = importScriptFromText(importText);
    const scriptWithSegments = createScriptWithSegments(importedScript.title, importedScript.content);
    setSelectedScript(scriptWithSegments);
    setSelectedSegmentId(null);
    setGeneratedPages([]);
    setShowImport(false);
    setImportText('');
  };

  const handleRegeneratePage = async (index: number) => {
    const pageToRegenerate = generatedPages[index];
    if (!pageToRegenerate || !selectedScript) return;

    const newPrompt = prompt('您可以微调提示词（留空使用原提示词）：', pageToRegenerate.text);
    if (newPrompt === null) return;

    const updatedPages = [...generatedPages];
    // 设置该页为“加载中”状态 (可选，通过 UI 标识)
    
    setGenerationLogs(prev => [...prev, { type: 'info', message: `重新生成第 ${pageToRegenerate.pageNumber} 页...` }]);

    try {
      const storyboardData = extractStoryboardFromScript(selectedScript.content);
      let requestBody: any;

      if (storyboardData) {
        const frame = { ...storyboardData.frames.find(f => f.frame_id === pageToRegenerate.pageNumber) };
        if (frame) {
          if (newPrompt.trim()) frame.image_prompt = newPrompt.trim();
          requestBody = { storyboard: { frames: [frame] } };
        }
      }

      if (!requestBody) {
        requestBody = { scriptSegment: `第${pageToRegenerate.pageNumber}页：${newPrompt.trim() || pageToRegenerate.text}` };
      }

      const selectedProfiles = visibleCharacters.filter((c) => selectedCharacterIds.includes(c.id));
      const characterReferencesToSend =
        useCharacterReferences && generationModel === 'wan2.5-i2i-preview'
          ? await buildCharacterReferenceMapForI2I(selectedProfiles)
          : characterReferences;

      const selectedForRef = visibleCharacters
        .filter((c) => selectedCharacterIds.includes(c.id) && !!c.referenceImageUrl)
        .map((c) => c.referenceImageUrl!)
        .slice(0, 5);

      const referenceImagesToSend =
        useCharacterReferences && generationModel === 'wan2.5-i2i-preview'
          ? (await Promise.all(selectedForRef.map((src) => toJpegDataUrlSafe(src)))).filter(Boolean)
          : undefined;

      const response = await fetch('/api/comic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...requestBody,
          startPageNumber: pageToRegenerate.pageNumber,
          scriptId: selectedScript.id,
          model: generationModel,
          characterReferences: characterReferencesToSend,
          referenceImages: referenceImagesToSend,
        }),
      });

      const result = await response.json();
      if (result.success && result.data?.pages?.length > 0) {
        updatedPages[index] = result.data.pages[0];
        setGeneratedPages(updatedPages);
        setGenerationLogs(prev => [...prev, { type: 'success', message: `✅ 第 ${pageToRegenerate.pageNumber} 页重新生成成功` }]);
        
        // 更新数据库中的绘本
        const comicBook = {
          scriptId: selectedScript.id,
          segmentId: selectedSegmentId,
          title: selectedScript.title,
          pages: updatedPages,
        };
        await saveComicBookToStorage(comicBook);
      } else {
        alert(result.error || '重新生成失败');
      }
    } catch (error: any) {
      alert(`重新生成失败: ${error.message}`);
    }
  };
  const handleGenerateComic = async () => {
    if (!selectedScript || selectedSegmentId === null) {
      alert('请选择脚本和片段');
      return;
    }

    if (useCharacterReferences) {
      const hasAnyRef = characters.some((c) => !!c.referenceImageUrl);
      if (!hasAnyRef) {
        alert('已启用“角色参考图”，但当前角色库没有任何立绘。请先点击“同步角色形象”，或关闭该开关后继续生成绘本。');
        return;
      }
    }

    const segment = selectedScript.segments.find(s => s.segmentId === selectedSegmentId);
    if (!segment) {
      alert('找不到选中的片段');
      return;
    }

    setIsGenerating(true);
    setGeneratedPages([]);
    setGenerationProgress(0);
    setGenerationLogs([{ type: 'info', message: '🚀 准备开始生成绘本...' }]);

    try {
      const selectedProfiles = visibleCharacters.filter((c) => selectedCharacterIds.includes(c.id));
      const isMultiModalModel = generationModel === 'wan2.5-i2i-preview' || generationModel === 'wan2.6-image';
      
      const characterReferencesToSend =
        useCharacterReferences && isMultiModalModel
          ? await buildCharacterReferenceMapForI2I(selectedProfiles)
          : characterReferences;

      const selectedForRef = visibleCharacters
        .filter((c) => selectedCharacterIds.includes(c.id) && !!c.referenceImageUrl)
        .map((c) => c.referenceImageUrl!)
        .slice(0, 5);

      const referenceImagesToSend =
        useCharacterReferences && isMultiModalModel
          ? (await Promise.all(selectedForRef.map((src) => toJpegDataUrlSafe(src)))).filter(Boolean)
          : undefined;

      if (isMultiModalModel && useCharacterReferences && (!referenceImagesToSend || referenceImagesToSend.length === 0)) {
        console.warn('当前选择的是多模态模型，但未提供有效的参考图');
      }

      const storyboardData = extractStoryboardFromScript(selectedScript.content);
      const allPages: ComicPage[] = [];
      
      if (storyboardData) {
        const startFrameIndex = (selectedSegmentId - 1) * 10;
        const segmentFrames = storyboardData.frames.slice(startFrameIndex, startFrameIndex + 10);
        
        if (segmentFrames.length === 0) {
          throw new Error('该片段没有对应的分镜数据');
        }

        setGenerationLogs(prev => [...prev, { type: 'info', message: `检测到分镜数据，共 ${segmentFrames.length} 页，准备逐页生成...` }]);

        for (let i = 0; i < segmentFrames.length; i++) {
          const frame = segmentFrames[i];
          const pageNumber = (selectedSegmentId - 1) * 10 + i + 1;
          
          setGenerationStatus(`正在生成第 ${pageNumber} 页...`);
          setGenerationLogs(prev => [...prev, { type: 'info', message: `正在生成第 ${pageNumber} 页：${frame.image_prompt.substring(0, 30)}...` }]);

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
            const newPage = result.data.pages[0];
            allPages.push(newPage);
            setGeneratedPages([...allPages]);
            setGenerationProgress(Math.round(((i + 1) / segmentFrames.length) * 100));
            setGenerationLogs(prev => [...prev, { type: 'success', message: `✅ 第 ${pageNumber} 页生成成功` }]);
          } else {
            const errorMsg = result.error || '生成失败';
            setGenerationLogs(prev => [...prev, { type: 'error', message: `❌ 第 ${pageNumber} 页生成失败: ${errorMsg}` }]);
            if (!confirm(`第 ${pageNumber} 页生成失败：${errorMsg}。是否跳过此页继续？`)) {
              break;
            }
          }
        }
      } else {
        // 文本模式 (退化处理)
        setGenerationLogs(prev => [...prev, { type: 'info', message: '未检测到结构化分镜，使用传统模式一次性生成...' }]);
        const response = await fetch('/api/comic/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scriptSegment: segment.content,
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
          setGeneratedPages(allPages);
          setGenerationProgress(100);
          setGenerationLogs(prev => [...prev, { type: 'success', message: '✅ 绘本全部生成成功' }]);
        } else {
          throw new Error(result.error || '生成失败');
        }
      }

      if (allPages.length > 0) {
        const comicBook = {
          scriptId: selectedScript.id,
          segmentId: selectedSegmentId,
          title: selectedScript.title,
          pages: allPages,
        };
        await saveComicBookToStorage(comicBook);
        setGenerationLogs(prev => [...prev, { type: 'success', message: '🎉 绘本已完整保存至数据库' }]);
      }
    } catch (error: any) {
      console.error('生成绘本失败:', error);
      setGenerationLogs(prev => [...prev, { type: 'error', message: `🔥 发生严重错误: ${error.message || '未知错误'}` }]);
      alert(`生成失败: ${error.message || '网络连接异常'}`);
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 animate-in fade-in duration-700">
      {/* 顶部标题栏 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary-50 rounded-2xl text-primary-600 shadow-sm">
              <Palette size={28} />
            </div>
            <h2 className="text-4xl font-black text-slate-800 tracking-tight">生成漫画绘本</h2>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-xs ml-1">Visual Storytelling Pipeline</p>
        </div>
        <button 
          onClick={onBack} 
          className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm hover:shadow-md active:scale-95 text-sm font-bold"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          返回工作台
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 左侧：参数配置面板 */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-8">
          {/* 脚本选择卡片 */}
          <section className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-primary-50 rounded-full blur-2xl opacity-50"></div>
            
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText size={20} className="text-primary-500" />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider">选择故事脚本</h3>
              </div>

              {selectedScript ? (
                <div className="space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="group relative w-full text-left p-5 rounded-2xl border-2 border-primary-500 bg-primary-50/30 shadow-lg shadow-primary-500/10">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-primary-700 font-black text-lg line-clamp-1">{selectedScript.title}</div>
                        <div className="flex items-center gap-2 text-primary-500/60 text-[10px] font-bold mt-1 uppercase">
                          <Clock size={10} />
                          {new Date(selectedScript.updatedAt || selectedScript.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="p-2 bg-primary-500 text-white rounded-lg">
                        <CheckCircle2 size={16} />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleResetScriptSelect} 
                    className="w-full py-3.5 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50/50 transition-all text-xs font-black uppercase tracking-widest"
                  >
                    重新选择脚本
                  </button>
                </div>
              ) : !showImport ? (
                <div className="space-y-4">
                  {savedScripts.length > 0 ? (
                    <div className="space-y-3 max-h-[320px] overflow-y-auto pr-2 scrollbar-thin">
                      {savedScripts.map((script) => (
                        <button
                          key={script.id}
                          onClick={() => handleScriptSelect(script)}
                          className="w-full text-left p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 transition-all group"
                        >
                          <div className="font-bold text-slate-700 group-hover:text-primary-600 transition-colors line-clamp-1">{script.title}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                            Last edited: {new Date(script.updatedAt || script.createdAt).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <AlertCircle size={24} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No scripts found</p>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowImport(true)} 
                    className="w-full py-4 rounded-2xl bg-slate-100 text-slate-600 font-black text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    手动导入外部脚本
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="relative">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="粘贴您的分镜脚本内容..."
                      rows={8}
                      className="textarea-field !rounded-3xl !bg-slate-50/50 !text-sm"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleImportScript} className="btn-primary flex-1 !rounded-xl !py-3">
                      确认导入
                    </button>
                    <button
                      onClick={() => {
                        setShowImport(false);
                        setImportText('');
                      }}
                      className="btn-secondary !rounded-xl !py-3"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 模型与参考图卡片 */}
          <section className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 border border-slate-100 space-y-8">
            {/* 模型选择 */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Layout size={20} className="text-primary-500" />
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider">生成模型设定</h3>
              </div>
              
              <div className="relative group">
                <select
                  value={generationModel}
                  onChange={(e) => setGenerationModel(e.target.value as GenerationModel)}
                  className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-2xl focus:outline-none focus:bg-white focus:border-primary-400 focus:ring-4 focus:ring-primary-500/5 text-sm font-bold text-slate-700 transition-all appearance-none"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-primary-500">
                  <ChevronDown size={18} />
                </div>
              </div>
              <div className="p-4 bg-primary-50/50 rounded-2xl border border-primary-100/50">
                <p className="text-[10px] leading-relaxed text-primary-700 font-medium">
                  <span className="font-black uppercase mr-1">Current Model:</span>
                  {MODEL_OPTIONS.find((o) => o.value === generationModel)?.description}
                </p>
              </div>
            </div>

            {/* 角色一致性控制 */}
            <div className="space-y-4 border-t border-slate-50 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-violet-500" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-wider">视觉一致性</h3>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCharacterReferences}
                    onChange={(e) => setUseCharacterReferences(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="bg-slate-50/50 rounded-[2rem] p-6 space-y-6">
                <div className="space-y-3">
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles size={12} />
                    立绘同步系统
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative group">
                      <select
                        className="w-full p-3.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:border-primary-400 transition-all appearance-none shadow-sm"
                        value={portraitModel}
                        onChange={(e) => setPortraitModel(e.target.value as GenerationModel)}
                        disabled={isGenerating || isGeneratingPortraits}
                      >
                        {PORTRAIT_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      className="btn-primary !rounded-xl !py-3 flex items-center justify-center gap-2 shadow-lg shadow-primary-200"
                      onClick={handleGeneratePortraits}
                      disabled={!selectedScript || isGenerating || isGeneratingPortraits}
                    >
                      {isGeneratingPortraits ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Wand2 size={18} />
                      )}
                      <span className="text-sm font-black">同步角色形象</span>
                    </button>
                  </div>
                </div>

                {visibleCharacters.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {selectedCharacterIds.length} Assets Selected
                      </div>
                      <button
                        type="button"
                        className="text-[10px] font-black text-primary-500 hover:text-primary-600 uppercase tracking-widest flex items-center gap-1"
                        onClick={() => setShowCharacterAdvanced(!showCharacterAdvanced)}
                      >
                        {showCharacterAdvanced ? 'Hide' : 'Manage'}
                        <Settings2 size={10} />
                      </button>
                    </div>

                    {showCharacterAdvanced && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                            <input
                              value={addFromLibraryQuery}
                              onChange={(e) => setAddFromLibraryQuery(e.target.value)}
                              placeholder="搜索角色..."
                              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:border-primary-300 transition-all"
                            />
                          </div>
                          <button
                            type="button"
                            className="p-2 bg-white border border-slate-100 rounded-xl text-primary-500 hover:bg-primary-50 transition-all shadow-sm"
                            onClick={() => setShowAddFromLibrary(!showAddFromLibrary)}
                            title="从库中添加"
                          >
                            <UserPlus size={18} />
                          </button>
                        </div>

                        {showAddFromLibrary && (
                          <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-white rounded-2xl border border-slate-100 shadow-inner scrollbar-thin">
                            {characters
                              .filter((c) => !visibleCharacters.some((v) => v.id === c.id))
                              .filter((c) => {
                                const q = addFromLibraryQuery.trim();
                                if (!q) return true;
                                const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
                                return keys.some((k) => String(k || '').includes(q)) || String(c.name || '').includes(q);
                              })
                              .map((c) => (
                                <div key={c.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center">
                                      {c.referenceImageUrl ? <img src={c.referenceImageUrl} className="w-full h-full object-cover" /> : <UserIcon size={14} className="text-slate-300" />}
                                    </div>
                                    <span className="text-xs font-bold text-slate-600">{c.name}</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setUserTouchedCharacterSelection(true);
                                      setExtraVisibleCharacterIds((prev) => Array.from(new Set([...prev, c.id])));
                                      setSelectedCharacterIds((prev) => Array.from(new Set([...prev, c.id])));
                                    }}
                                    className="p-1.5 text-primary-500 hover:bg-primary-50 rounded-lg transition-all"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}

                        <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                          {visibleCharacters.map((c) => (
                            <label key={c.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 bg-white hover:border-primary-200 transition-all cursor-pointer group shadow-sm">
                              <div className="relative">
                                <input
                                  type="checkbox"
                                  checked={selectedCharacterIds.includes(c.id)}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setUserTouchedCharacterSelection(true);
                                    setSelectedCharacterIds((prev) =>
                                      checked ? Array.from(new Set([...prev, c.id])) : prev.filter((id) => id !== c.id)
                                    );
                                  }}
                                  disabled={!useCharacterReferences}
                                  className="sr-only peer"
                                />
                                <div className="w-5 h-5 border-2 border-slate-200 rounded-lg peer-checked:bg-primary-500 peer-checked:border-primary-500 transition-all flex items-center justify-center">
                                  <CheckCircle2 size={12} className="text-white opacity-0 peer-checked:opacity-100 transition-all" />
                                </div>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-slate-50 overflow-hidden border border-slate-100 group-hover:border-primary-100 transition-all flex items-center justify-center">
                                {c.referenceImageUrl ? <img src={c.referenceImageUrl} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-slate-200" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black text-slate-700 truncate">{c.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                                  {(c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name]).join(' / ')}
                                </div>
                              </div>
                              {!c.referenceImageUrl && <AlertCircle size={14} className="text-amber-400" />}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* 右侧：生成控制与预览 */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-8">
          <section className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 p-8 md:p-12 border border-slate-100 min-h-[600px] flex flex-col">
            <div className="flex items-center justify-between mb-10 px-2">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-violet-50 rounded-2xl text-violet-600 shadow-sm shadow-violet-100">
                  <ImageIcon size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">渲染预览 (Render Engine)</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Ready</span>
                  </div>
                </div>
              </div>
              
              {selectedScript && selectedSegmentId !== null && (
                <button
                  onClick={handleGenerateComic}
                  disabled={isGenerating}
                  className="btn-primary !py-3.5 !px-8 !rounded-2xl flex items-center gap-3 shadow-xl shadow-primary-200 group transition-all"
                >
                  {isGenerating ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Play size={20} className="group-hover:translate-x-0.5 transition-transform" />
                  )}
                  <span className="text-base font-black">执行生成流水线</span>
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col">
              {!selectedScript ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                  <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <FileText size={48} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">Please select a script to begin</p>
                </div>
              ) : selectedSegmentId === null ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="mb-10 max-w-md w-full animate-in zoom-in-95 duration-500">
                    <div className="p-6 bg-primary-50 rounded-[2.5rem] border border-primary-100 shadow-inner">
                      <div className="text-primary-600 mb-6 flex justify-center">
                        <Layers size={40} />
                      </div>
                      <h4 className="text-lg font-black text-primary-800 mb-2 tracking-tight">分段处理系统</h4>
                      <p className="text-xs font-bold text-primary-600/70 uppercase tracking-widest leading-relaxed mb-8">
                        脚本共切分为 {selectedScript.totalSegments} 个片段<br/>请选择一个执行渲染
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedScript.segments.map((segment) => (
                          <button
                            key={segment.segmentId}
                            onClick={() => setSelectedSegmentId(segment.segmentId)}
                            className="p-4 rounded-2xl bg-white border border-primary-100 text-primary-600 font-black text-sm hover:shadow-lg hover:-translate-y-1 transition-all active:scale-95 shadow-sm"
                          >
                            #{segment.segmentId}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-500">
                  <div className="w-full max-w-lg space-y-10">
                    <div className="relative flex justify-center">
                      <div className="w-40 h-40 border-8 border-slate-50 border-t-primary-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-slate-800 tabular-nums">{generationProgress}%</span>
                        <Sparkles size={24} className="text-primary-400 animate-pulse mt-1" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                        <span>{generationStatus || 'AI 引擎正在全力工作中...'}</span>
                        <span>{Math.round(generationProgress/10)} / 10 Stages</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50 p-0.5">
                        <div 
                          className="h-full bg-gradient-to-r from-primary-500 via-brand-violet to-primary-500 rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${generationProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl overflow-hidden border border-slate-800">
                      <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live Engine Logs</span>
                      </div>
                      <div className="space-y-2 h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800 font-mono text-[11px]">
                        {generationLogs.map((log, i) => (
                          <div key={i} className={`flex items-start gap-3 animate-in slide-in-from-left-2 duration-300 ${
                            log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-400'
                          }`}>
                            <span className="opacity-30 shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                            <span className="leading-relaxed">{log.message}</span>
                          </div>
                        ))}
                        <div id="logs-end" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : generatedPages.length > 0 ? (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 max-h-[1000px] overflow-y-auto pr-4 scrollbar-thin">
                  {generatedPages.map((page, index) => (
                    <div key={page.pageNumber} className="relative group/page">
                      <div className="absolute -left-4 top-0 bottom-0 w-1 bg-slate-100 group-hover/page:bg-primary-500 transition-colors rounded-full"></div>
                      <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl font-black text-slate-800 tabular-nums">#{String(page.pageNumber).padStart(2, '0')}</span>
                          <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-wider">Asset Rendered</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRegeneratePage(index)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-primary-600 hover:border-primary-200 transition-all shadow-sm active:scale-95"
                          >
                            <RefreshCw size={14} />
                            重新渲染此页
                          </button>
                          <button className="p-2 text-slate-300 hover:text-primary-500 transition-colors" title="Quick Preview">
                            <Eye size={18} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 rounded-3xl p-4 md:p-6 transition-all group-hover/page:bg-white group-hover/page:shadow-2xl group-hover/page:shadow-primary-500/5 group-hover/page:ring-1 group-hover/page:ring-slate-100">
                        <ComicPageCanvas page={page} className="w-full" />
                        
                        {(page.narration || (page.dialogue && page.dialogue.length > 0)) && (
                          <div className="mt-6 pt-6 border-t border-slate-100">
                            <details className="group/details">
                              <summary className="flex items-center gap-2 cursor-pointer list-none text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
                                <ChevronRight size={12} className="group-open/details:rotate-90 transition-transform" />
                                Inspect Metadata
                              </summary>
                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                                {page.narration && (
                                  <div className="space-y-2">
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Narration</div>
                                    <p className="text-xs font-medium text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-50 shadow-sm">{page.narration}</p>
                                  </div>
                                )}
                                {page.dialogue && page.dialogue.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-[9px] font-black text-slate-400 uppercase">Dialogues</div>
                                    <div className="space-y-2">
                                      {page.dialogue.map((d, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-50 shadow-sm flex items-start gap-3">
                                          <div className="w-5 h-5 rounded bg-primary-50 flex items-center justify-center text-primary-600 text-[10px] font-black shrink-0">
                                            {typeof d === 'string' ? '?' : d.role[0]}
                                          </div>
                                          <p className="text-xs font-medium text-slate-600 leading-relaxed italic">
                                            {typeof d === 'string' ? d : `"${d.text}"`}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                  <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                    <ImageIcon size={48} className="text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-sm">Output ready for engine command</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

async function toJpegDataUrlSafe(src: string): Promise<string | undefined> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      el.src = src;
    });

    // 控制尺寸，避免 dataURL 过大：最长边 512（进一步降低 DataInspection 风险）
    const maxSide = 512;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL('image/jpeg', 0.78);
  } catch (e) {
    console.warn(e);
    return undefined;
  }
}

async function buildCharacterReferenceMapForI2I(selected: CharacterProfile[]): Promise<Record<string, string> | undefined> {
  const map: Record<string, string> = {};
  for (const c of selected) {
    if (!c.referenceImageUrl) continue;
    const jpeg = await toJpegDataUrlSafe(c.referenceImageUrl);
    if (!jpeg) continue;
    const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
    for (const k of keys) {
      const key = String(k || '').trim();
      if (key) map[key] = jpeg;
    }
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

function buildCharacterReferenceMap(selected: CharacterProfile[]): Record<string, string> | undefined {
  const map: Record<string, string> = {};
  for (const c of selected) {
    if (!c.referenceImageUrl) continue;
    const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
    for (const k of keys) {
      const key = String(k || '').trim();
      if (key) map[key] = c.referenceImageUrl;
    }
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

function extractRoleNamesFromScript(content: string): Set<string> {
  const set = new Set<string>();
  try {
    const sb = extractStoryboardFromScript(content);
    if (sb && Array.isArray(sb.frames)) {
      for (const f of sb.frames) {
        for (const d of f.dialogues || []) {
          const role = String(d.role || '').trim();
          if (role) set.add(role);
        }
      }
      if (set.size > 0) return set;
    }
  } catch {
    // ignore
  }

  // 文本脚本兜底：抓取形如 “角色：对白” 或 “角色："对白"” 的角色名
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([^：:\s]{1,20})\s*[：:]/);
    if (m?.[1]) set.add(m[1].trim());
  }
  return set;
}

async function buildCombinedReferenceImage(selected: CharacterProfile[]): Promise<string | undefined> {
  const withRef = selected.filter((c) => !!c.referenceImageUrl);
  if (withRef.length === 0) return undefined;
  if (withRef.length === 1) return withRef[0].referenceImageUrl;

  // 限制最多拼 4 张 + 降低分辨率/改用 JPEG，避免 DashScope “DataInspection length” 限制
  const items = withRef.slice(0, 4);
  const tile = 192;
  const cols = 2;
  const rows = Math.ceil(items.length / cols);

  const canvas = document.createElement('canvas');
  canvas.width = cols * tile;
  canvas.height = rows * tile;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      // 同源 /comic-assets 不需要 CORS，但设置也不影响
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });

  for (let i = 0; i < items.length; i++) {
    const src = items[i].referenceImageUrl!;
    try {
      const img = await load(src);
      const x = (i % cols) * tile;
      const y = Math.floor(i / cols) * tile;
      // contain 绘制：保持比例居中
      const scale = Math.min(tile / img.width, tile / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const dx = x + (tile - w) / 2;
      const dy = y + (tile - h) / 2;
      ctx.drawImage(img, dx, dy, w, h);
    } catch (e) {
      // 单张失败不影响整体
      console.warn(e);
    }
  }

  try {
    // JPEG 会显著减小 dataURL 长度
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  }
}

