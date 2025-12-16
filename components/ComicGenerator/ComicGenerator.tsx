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

const MODEL_OPTIONS: Array<{
  value: GenerationModel;
  label: string;
  description: string;
  isAsync: boolean;
}> = [
  {
    value: 'wan2.6-image',
    label: '万相 wan2.6-image',
    description: '通用文生图模型（不走参考图），适合高质量场景插图',
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
}

export default function ComicGenerator({ onBack }: ComicGeneratorProps) {
  const [savedScripts, setSavedScripts] = useState<Script[]>([]);
  const [selectedScript, setSelectedScript] = useState<ScriptWithSegments | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
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
    // 未选脚本：展示全量角色库
    if (!scriptRoleNames || scriptRoleNames.size === 0) return characters;

    const extraSet = new Set(extraVisibleCharacterIds);
    return characters.filter((c) => {
      if (extraSet.has(c.id)) return true;
      const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
      return keys.some((k) => scriptRoleNames.has(String(k || '').trim()));
    });
  }, [characters, scriptRoleNames, extraVisibleCharacterIds]);

  useEffect(() => {
    const scripts = loadScriptsFromStorage();
    // 最新脚本排在最前：优先按 updatedAt，其次 createdAt（降序）
    const sorted = [...scripts].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
    setSavedScripts(sorted);
    const chars = loadCharactersFromStorage();
    setCharacters(chars);
    // 默认全自动：自动选中所有已生成立绘的角色（用户无需手动勾选）
    setSelectedCharacterIds(chars.filter(c => !!c.referenceImageUrl).map(c => c.id));
  }, []);

  const refreshCharacters = () => {
    const chars = loadCharactersFromStorage();
    setCharacters(chars);
    // selectedCharacterIds 由“选中脚本后的自动筛选”逻辑接管（避免混入历史脚本的角色）
  };

  // 选中脚本后，自动勾选该脚本涉及且已生成立绘的角色
  useEffect(() => {
    if (!selectedScript) return;
    const ids = visibleCharacters.filter((c) => !!c.referenceImageUrl).map((c) => c.id);
    if (!userTouchedCharacterSelection) {
      setSelectedCharacterIds(ids);
    }
  }, [selectedScript?.id, visibleCharacters, userTouchedCharacterSelection]);

  const characterReferences = useCharacterReferences
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
      chars.forEach((c) =>
        upsertCharacter({
          ...c,
          sourceType: 'script',
          sourceScriptId: selectedScript.id,
          sourceScriptTitle: selectedScript.title,
          updatedAt: new Date().toISOString(),
        })
      );
      refreshCharacters();
      alert(`角色立绘生成完成：${chars.filter((c) => !!c.referenceImageUrl).length}/${chars.length}`);
    } catch (e) {
      console.error(e);
      alert('生成失败，请检查网络连接');
    } finally {
      setIsGeneratingPortraits(false);
    }
  };

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

  const handleGenerateComic = async () => {
    if (!selectedScript || selectedSegmentId === null) {
      alert('请选择脚本和片段');
      return;
    }

    // 如果启用了参考图但没有任何可用 referenceImageUrl，提示用户先生成立绘或关闭开关
    if (useCharacterReferences) {
      const hasAnyRef = characters.some((c) => !!c.referenceImageUrl);
      if (!hasAnyRef) {
        alert('已启用“角色参考图”，但当前角色库没有任何立绘。请先点击“生成角色立绘”，或关闭该开关后继续生成绘本。');
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

    try {
      // i2i 场景：把角色库中的本地 PNG 立绘提前压缩为 JPEG dataURL，
      // 避免后端把大 PNG 转 base64 导致 DashScope DataInspection 长度超限。
      const selectedProfiles = visibleCharacters.filter((c) => selectedCharacterIds.includes(c.id));
      const characterReferencesToSend =
        useCharacterReferences && generationModel === 'wan2.5-i2i-preview'
          ? await buildCharacterReferenceMapForI2I(selectedProfiles)
          : characterReferences;

      // i2i 模型必须带底图：直接使用多张立绘（input.images 支持数组），避免拼图带来的尺寸/审查限制
      const selectedForRef = visibleCharacters
        .filter((c) => selectedCharacterIds.includes(c.id) && !!c.referenceImageUrl)
        .map((c) => c.referenceImageUrl!)
        .slice(0, 5);

      // DashScope i2i 对媒体格式/审查更敏感：将本地 PNG 统一转为 JPEG dataURL（更通用且体积更小）
      const referenceImagesToSend =
        useCharacterReferences && generationModel === 'wan2.5-i2i-preview'
          ? (await Promise.all(selectedForRef.map((src) => toJpegDataUrlSafe(src)))).filter(Boolean)
          : undefined;

      if (generationModel === 'wan2.5-i2i-preview' && (!referenceImagesToSend || referenceImagesToSend.length === 0)) {
        alert('当前选择的是 wan2.5-i2i-preview（图生图），必须提供至少 1 张立绘作为底图。请先生成立绘或切换模型。');
        setIsGenerating(false);
        return;
      }

      // 尝试从脚本中提取分镜数据
      const storyboardData = extractStoryboardFromScript(selectedScript.content);
      
      let requestBody: any;
      
      if (storyboardData) {
        // 如果有分镜数据，使用分镜数据生成
        console.log('检测到分镜数据，使用分镜模式生成');
        // 根据segmentId选择对应的frames
        const startFrameIndex = (selectedSegmentId - 1) * 10;
        const endFrameIndex = startFrameIndex + 10;
        const segmentFrames = storyboardData.frames.slice(startFrameIndex, endFrameIndex);
        
        if (segmentFrames.length === 0) {
          alert('该片段没有对应的分镜数据');
          setIsGenerating(false);
          return;
        }
        
        requestBody = {
          storyboard: {
            frames: segmentFrames,
          },
          startPageNumber: (selectedSegmentId - 1) * 10 + 1,
          scriptId: selectedScript.id,
          segmentId: selectedSegmentId,
          model: generationModel,
          characterReferences: characterReferencesToSend,
          referenceImages: referenceImagesToSend,
        };
      } else {
        // 否则使用文本模式（兼容旧格式）
        console.log('未检测到分镜数据，使用文本模式生成');
        requestBody = {
          scriptSegment: segment.content,
          startPageNumber: (selectedSegmentId - 1) * 10 + 1,
          scriptId: selectedScript.id,
          segmentId: selectedSegmentId,
          model: generationModel,
          characterReferences: characterReferencesToSend,
          referenceImages: referenceImagesToSend,
        };
      }

      const response = await fetch('/api/comic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success && result.data?.pages) {
        const pages = result.data.pages;
        setGeneratedPages(pages);
        
        // 保存生成的绘本到本地存储
        const now = new Date().toISOString();
        const comicBook: ComicBook = {
          id: `comic_${Date.now()}`,
          scriptId: selectedScript.id,
          segmentId: selectedSegmentId,
          title: selectedScript.title, // 默认使用脚本标题
          pages: pages,
          createdAt: now,
          updatedAt: now,
        };
        saveComicBookToStorage(comicBook);
        console.log('绘本已保存到本地存储:', comicBook.id);
      } else {
        alert(result.error || '生成失败');
      }
    } catch (error) {
      console.error('生成绘本失败:', error);
      alert('生成失败，请检查网络连接');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="card max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">生成漫画绘本</h2>
        <button onClick={onBack} className="btn-secondary">
          返回首页
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：脚本选择 */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">选择脚本</h3>

            {/* 选中脚本后“锁定”脚本列表：只保留目标脚本，避免难以辨认 */}
            {selectedScript ? (
              <div className="space-y-3">
                <div className="w-full text-left p-3 rounded-lg border-2 border-primary-500 bg-primary-50">
                  <div className="font-medium">{selectedScript.title}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    更新时间：{new Date(selectedScript.updatedAt || selectedScript.createdAt).toLocaleString()}
                  </div>
                </div>
                <button onClick={handleResetScriptSelect} className="btn-secondary w-full">
                  返回上一步：重新选择脚本
                </button>
              </div>
            ) : !showImport ? (
              <div className="space-y-3">
                {savedScripts.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedScripts.map((script) => (
                      <button
                        key={script.id}
                        onClick={() => handleScriptSelect(script)}
                        className="w-full text-left p-3 rounded-lg border-2 transition-colors border-gray-200 hover:border-primary-300"
                      >
                        <div className="font-medium">{script.title}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          更新时间：{new Date(script.updatedAt || script.createdAt).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">暂无保存的脚本</p>
                )}

                <button onClick={() => setShowImport(true)} className="btn-secondary w-full">
                  导入外部脚本
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="粘贴你的脚本内容..."
                  rows={8}
                  className="textarea-field"
                />
                <div className="flex gap-2">
                  <button onClick={handleImportScript} className="btn-primary flex-1">
                    导入
                  </button>
                  <button
                    onClick={() => {
                      setShowImport(false);
                      setImportText('');
                    }}
                    className="btn-secondary"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* 模型选择 */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800">选择生成模型</h3>
            <select
              value={generationModel}
              onChange={(e) => setGenerationModel(e.target.value as GenerationModel)}
              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <div>
                当前模型：{MODEL_OPTIONS.find((o) => o.value === generationModel)?.description || '请选择模型'}
              </div>
              <div>通义万相模型采用异步生成，需等待任务完成后返回图片。</div>
            </div>
          </div>

          {/* 角色参考图（跨帧一致性） */}
          <div className="bg-white/70 backdrop-blur rounded-xl p-4 border-2 border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">角色参考图（跨帧一致性）</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={useCharacterReferences}
                  onChange={(e) => setUseCharacterReferences(e.target.checked)}
                />
                启用
              </label>
            </div>

            <p className="text-xs text-gray-600 mb-3">
              勾选角色后，生成每页时会尝试把角色的 <span className="font-semibold">参考图</span> 作为 <span className="font-semibold">image_reference</span> 传给模型，以提升“几乎同一张脸”的一致性。
              <br />
              匹配规则：按对话里的 <code>role</code>（或“角色：对白”中的角色名）匹配角色名/匹配名。
            </p>

            <div className="bg-white rounded-lg border border-purple-200 p-3 mb-3">
              <div className="text-sm font-semibold text-gray-800 mb-2">第 1 步：生成角色立绘（可选）</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                <select
                  className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm"
                  value={portraitModel}
                  onChange={(e) => setPortraitModel(e.target.value as GenerationModel)}
                  disabled={isGenerating || isGeneratingPortraits}
                >
                  {PORTRAIT_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary sm:col-span-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleGeneratePortraits}
                  disabled={!selectedScript || isGenerating || isGeneratingPortraits}
                >
                  {isGeneratingPortraits ? '生成角色立绘中...' : '生成角色立绘'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                说明：该步骤会用“脚本内容”推断角色并生成立绘，生成后会自动写入角色库并在下方自动勾选。
              </p>
            </div>

            {visibleCharacters.length === 0 ? (
              <div className="text-xs text-gray-500">
                当前脚本还没有匹配到角色参考图。你可以先在上方点击“生成角色立绘”，也可以到“角色库”手动生成/补充匹配名。
              </div>
            ) : (
              <>
                <div className="text-xs text-gray-600 mb-2">
                  已自动启用 {selectedCharacterIds.length} 个角色参考图。
                  <button
                    type="button"
                    className="ml-2 text-purple-600 hover:text-purple-700 underline"
                    onClick={() => setShowCharacterAdvanced(v => !v)}
                  >
                    {showCharacterAdvanced ? '收起' : '高级设置'}
                  </button>
                </div>
                {showCharacterAdvanced && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600">
                        仅显示与当前脚本匹配的角色。若需补充，可从角色库手动添加（建议同步在角色库中完善匹配名）。
                      </div>
                      <button
                        type="button"
                        className="text-xs text-purple-600 hover:text-purple-700 underline"
                        onClick={() => setShowAddFromLibrary((v) => !v)}
                        disabled={!selectedScript}
                      >
                        {showAddFromLibrary ? '收起添加' : '从角色库中添加'}
                      </button>
                    </div>

                    {showAddFromLibrary && (
                      <div className="rounded-lg border border-purple-200 bg-white p-2 space-y-2">
                        <input
                          value={addFromLibraryQuery}
                          onChange={(e) => setAddFromLibraryQuery(e.target.value)}
                          placeholder="搜索角色名..."
                          className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm"
                        />
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {characters
                            .filter((c) => !visibleCharacters.some((v) => v.id === c.id))
                            .filter((c) => {
                              const q = addFromLibraryQuery.trim();
                              if (!q) return true;
                              const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
                              return keys.some((k) => String(k || '').includes(q)) || String(c.name || '').includes(q);
                            })
                            .slice(0, 50)
                            .map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center gap-2 p-2 rounded border border-gray-200 bg-white"
                              >
                                <div className="w-9 h-9 rounded overflow-hidden bg-gray-100 flex items-center justify-center border">
                                  {c.referenceImageUrl ? (
                                    <img src={c.referenceImageUrl} alt={c.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-base">👤</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-gray-800 truncate">{c.name}</div>
                                  <div className="text-xs text-gray-500 truncate">
                                    匹配名：{(c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name]).join('、')}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-50"
                                  onClick={() => {
                                    setUserTouchedCharacterSelection(true);
                                    setExtraVisibleCharacterIds((prev) => Array.from(new Set([...prev, c.id])));
                                    setSelectedCharacterIds((prev) => Array.from(new Set([...prev, c.id])));
                                  }}
                                >
                                  添加
                                </button>
                              </div>
                            ))}
                          {characters.filter((c) => !visibleCharacters.some((v) => v.id === c.id)).length === 0 && (
                            <div className="text-xs text-gray-500 py-2">没有可添加的角色（已全部在当前列表中）。</div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto">
                    {visibleCharacters.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 bg-white">
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
                        />
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center border">
                          {c.referenceImageUrl ? (
                            <img src={c.referenceImageUrl} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg">👤</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-gray-800 truncate">{c.name}</div>
                          <div className="text-xs text-gray-500 truncate">
                            匹配名：{(c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name]).join('、')}
                          </div>
                        </div>
                        {!c.referenceImageUrl && (
                          <span className="text-xs text-orange-600">未生成立绘</span>
                        )}
                      </label>
                    ))}
                  </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 脚本片段选择 */}
          {selectedScript && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-gray-800">
                选择脚本片段（共{selectedScript.totalSegments}段）
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedScript.segments.map((segment) => (
                  <button
                    key={segment.segmentId}
                    onClick={() => setSelectedSegmentId(segment.segmentId)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedSegmentId === segment.segmentId
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    <div className="font-medium">片段 {segment.segmentId}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      约 {segment.pageCount} 页
                    </div>
                    <div className="text-xs text-gray-400 mt-1 line-clamp-2">
                      {segment.content.substring(0, 100)}...
                    </div>
                  </button>
                ))}
              </div>
              
              {selectedSegmentId !== null && (
                <button
                  onClick={handleGenerateComic}
                  disabled={isGenerating}
                  className="btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? '生成中...' : '生成绘本'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* 右侧：绘本预览 */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-800">绘本预览</h3>
          
          {isGenerating ? (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">正在生成绘本...</p>
              </div>
            </div>
          ) : generatedPages.length > 0 ? (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {generatedPages.map((page) => (
                <div key={page.pageNumber} className="border border-gray-200 rounded-lg p-4 bg-white">
                  <div className="text-sm font-medium text-gray-600 mb-2">
                    第 {page.pageNumber} 页
                  </div>
                  
                  {/* 使用Canvas组件，在图片上叠加对话和旁白 */}
                  <ComicPageCanvas page={page} />
                  
                  {/* 可选：在下方显示原始文本信息（用于调试或查看） */}
                  {(page.narration || (page.dialogue && page.dialogue.length > 0)) && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        查看文本内容
                      </summary>
                      <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded">
                        {page.narration && (
                          <div>
                            <span className="font-semibold text-blue-700">旁白：</span>
                            <span className="text-gray-700">{page.narration}</span>
                          </div>
                        )}
                        {page.dialogue && page.dialogue.length > 0 && (
                          <div>
                            <span className="font-semibold text-purple-700">对话：</span>
                            <div className="mt-1 space-y-1">
                              {page.dialogue.map((dialogue, index) => {
                                // 处理新旧两种格式
                                if (typeof dialogue === 'string') {
                                  // 旧格式：字符串
                                  return <div key={index} className="text-gray-700">{dialogue}</div>;
                                } else {
                                  // 新格式：DialogueItem对象
                                  return (
                                    <div key={index} className="text-gray-700">
                                      {dialogue.role}："{dialogue.text}" 
                                      <span className="text-xs text-gray-500 ml-2">
                                        ({dialogue.anchor}, {dialogue.x_ratio.toFixed(2)}, {dialogue.y_ratio.toFixed(2)})
                                      </span>
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
              <p className="text-gray-500">选择脚本片段并点击生成</p>
            </div>
          )}
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

