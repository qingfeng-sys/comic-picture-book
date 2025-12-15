'use client';

import { useState, useEffect } from 'react';
import { Script, ScriptWithSegments, ComicPage, StoryboardData, ComicBook, GenerationModel, CharacterProfile } from '@/types';
import { createScriptWithSegments, loadScriptsFromStorage, importScriptFromText, extractStoryboardFromScript, saveComicBookToStorage } from '@/lib/scriptUtils';
import ComicPageCanvas from '@/components/ComicPageCanvas/ComicPageCanvas';
import { loadCharactersFromStorage } from '@/lib/characterUtils';

const MODEL_OPTIONS: Array<{
  value: GenerationModel;
  label: string;
  description: string;
  isAsync: boolean;
}> = [
  {
    value: 'wan2.5-t2i-preview',
    label: '通义万相 V2.5 Preview',
    description: '异步，通义万相最新版预览，质量高',
    isAsync: true,
  },
  {
    value: 'wan2.2-t2i-plus',
    label: '通义万相 2.2 Plus',
    description: '异步，均衡质量与速度，适合主用',
    isAsync: true,
  },
  {
    value: 'wan2.2-t2i-flash',
    label: '通义万相 2.2 Flash',
    description: '异步，快速出图，质量略低',
    isAsync: true,
  },
  {
    value: 'wanx2.1-t2i-plus',
    label: '通义万相 X2.1 Plus',
    description: '异步，高清质量，速度中等',
    isAsync: true,
  },
  {
    value: 'wanx2.1-t2i-turbo',
    label: '通义万相 X2.1 Turbo',
    description: '异步，加速模式，适合快速预览',
    isAsync: true,
  },
  {
    value: 'wanx2.0-t2i-turbo',
    label: '通义万相 X2.0 Turbo',
    description: '异步，早期版本，速度快',
    isAsync: true,
  },
  {
    value: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image（七牛）',
    description: '同步返回，速度快',
    isAsync: false,
  },
  {
    value: 'kling-v1',
    label: 'Kling v1（七牛）',
    description: '异步任务，质量高',
    isAsync: true,
  },
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
  const [generationModel, setGenerationModel] = useState<GenerationModel>(MODEL_OPTIONS[0].value);
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [useCharacterReferences, setUseCharacterReferences] = useState(true);
  const [showCharacterAdvanced, setShowCharacterAdvanced] = useState(false);

  useEffect(() => {
    const scripts = loadScriptsFromStorage();
    setSavedScripts(scripts);
    const chars = loadCharactersFromStorage();
    setCharacters(chars);
    // 默认全自动：自动选中所有已生成立绘的角色（用户无需手动勾选）
    setSelectedCharacterIds(chars.filter(c => !!c.referenceImageUrl).map(c => c.id));
  }, []);

  const characterReferences = useCharacterReferences
    ? buildCharacterReferenceMap(characters.filter(c => selectedCharacterIds.includes(c.id)))
    : undefined;

  const handleScriptSelect = (script: Script) => {
    const scriptWithSegments = createScriptWithSegments(script.title, script.content);
    setSelectedScript(scriptWithSegments);
    setSelectedSegmentId(null);
    setGeneratedPages([]);
  };

  const handleImportScript = () => {
    if (!importText.trim()) {
      alert('请输入脚本内容');
      return;
    }

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

    const segment = selectedScript.segments.find(s => s.segmentId === selectedSegmentId);
    if (!segment) {
      alert('找不到选中的片段');
      return;
    }

    setIsGenerating(true);
    setGeneratedPages([]);

    try {
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
          characterReferences: characterReferences,
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
          characterReferences: characterReferences,
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
            
            {!showImport ? (
              <div className="space-y-3">
                {savedScripts.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {savedScripts.map((script) => (
                      <button
                        key={script.id}
                        onClick={() => handleScriptSelect(script)}
                        className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                          selectedScript?.id === script.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300'
                        }`}
                      >
                        <div className="font-medium">{script.title}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {new Date(script.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">暂无保存的脚本</p>
                )}
                
                <button
                  onClick={() => setShowImport(true)}
                  className="btn-secondary w-full"
                >
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

            {characters.length === 0 ? (
              <div className="text-xs text-gray-500">
                还没有角色参考图。请先到“角色库”生成角色立绘。
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
                  <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto">
                    {characters.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 bg-white">
                        <input
                          type="checkbox"
                          checked={selectedCharacterIds.includes(c.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
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

