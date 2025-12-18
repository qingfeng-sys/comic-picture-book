'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CharacterProfile, GenerationModel, Script } from '@/types';
import { deleteCharacter, loadCharactersFromStorage, upsertCharacter } from '@/lib/characterUtils';
import { loadScriptsFromStorage, extractStoryboardFromScript } from '@/lib/scriptUtils';

const PORTRAIT_MODELS: Array<{ value: GenerationModel; label: string }> = [
  { value: 'wan2.5-t2i-preview', label: '通义万相 V2.5 Preview（文生图）' },
  { value: 'wan2.2-t2i-plus', label: '通义万相 2.2 Plus（文生图）' },
  { value: 'wan2.2-t2i-flash', label: '通义万相 2.2 Flash（文生图）' },
  { value: 'wanx2.1-t2i-plus', label: '通义万相 X2.1 Plus（文生图）' },
  { value: 'wanx2.1-t2i-turbo', label: '通义万相 X2.1 Turbo（文生图）' },
  { value: 'wanx2.0-t2i-turbo', label: '通义万相 X2.0 Turbo（文生图）' },
];

export default function CharacterLibrary() {
  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);

  const [view, setView] = useState<'groups' | 'groupDetail' | 'create'>('groups');
  const [activeGroup, setActiveGroup] = useState<
    | { type: 'script'; scriptId: string; title: string }
    | { type: 'custom'; title: string }
  >({ type: 'custom', title: '自定义角色' });
  const [moveTargetById, setMoveTargetById] = useState<Record<string, string>>({});
  const [moveOpenForId, setMoveOpenForId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visual, setVisual] = useState('');
  const [matchNames, setMatchNames] = useState(''); // 逗号分隔
  const [model, setModel] = useState<GenerationModel>('wan2.2-t2i-plus');

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setCharacters(loadCharactersFromStorage());
    setScripts(loadScriptsFromStorage());
  }, []);

  const sortedAll = useMemo(() => {
    return [...characters].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }, [characters]);

  const customCharacters = useMemo(() => {
    return sortedAll.filter((c) => c.sourceType === 'custom');
  }, [sortedAll]);

  const scriptGroups = useMemo(() => {
    const scriptsSorted = [...scripts].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));

    const roleSetByScriptId = new Map<string, Set<string>>();
    for (const s of scriptsSorted) {
      roleSetByScriptId.set(s.id, extractRoleNamesFromScriptContent(s.content));
    }

    // 已显式标注脚本来源的角色：优先使用 sourceScriptId
    const groups = new Map<string, { scriptId: string; title: string; characters: CharacterProfile[] }>();
    for (const s of scriptsSorted) {
      groups.set(s.id, { scriptId: s.id, title: s.title, characters: [] });
    }

    // 如果脚本已被删除，但角色仍绑定了 sourceScriptId，则创建“残留分组”以保持位置稳定
    for (const c of sortedAll) {
      if (c.sourceType !== 'script' || !c.sourceScriptId) continue;
      if (!groups.has(c.sourceScriptId)) {
        groups.set(c.sourceScriptId, {
          scriptId: c.sourceScriptId,
          title: c.sourceScriptTitle || `已删除脚本（${c.sourceScriptId}）`,
          characters: [],
        });
      }
    }

    // 先放入明确标注来源的角色
    const unassigned: CharacterProfile[] = [];
    for (const c of sortedAll) {
      if (c.sourceType === 'custom') continue;
      if (c.sourceType === 'script' && c.sourceScriptId && groups.has(c.sourceScriptId)) {
        groups.get(c.sourceScriptId)!.characters.push(c);
      } else {
        unassigned.push(c);
      }
    }

    // 对历史数据/未标注来源的角色：按“脚本角色名集合”做一次归类（避免丢失）
    for (const c of unassigned) {
      const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
      let assigned = false;
      for (const s of scriptsSorted) {
        const roleSet = roleSetByScriptId.get(s.id);
        if (!roleSet || roleSet.size === 0) continue;
        if (keys.some((k) => roleSet.has(String(k || '').trim()))) {
          groups.get(s.id)!.characters.push(c);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        // 没法归类的历史角色，后面单独显示在“自定义角色（未归类）”里
      }
    }

    // 只返回有角色的脚本组
    return Array.from(groups.values())
      .filter((g) => g.characters.length > 0)
      .map((g) => ({
        ...g,
        characters: [...g.characters].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)),
      }));
  }, [scripts, sortedAll]);

  const uncategorized = useMemo(() => {
    const scriptRoleSets = scripts.map((s) => extractRoleNamesFromScriptContent(s.content));
    return sortedAll.filter((c) => {
      if (c.sourceType === 'custom') return false;
      if (c.sourceType === 'script' && c.sourceScriptId) return false;
      const keys = c.matchNames && c.matchNames.length > 0 ? c.matchNames : [c.name];
      const hitAny = scriptRoleSets.some((set) => set.size > 0 && keys.some((k) => set.has(String(k || '').trim())));
      return !hitAny;
    });
  }, [sortedAll, scripts]);

  async function handleCreateAndGenerate() {
    if (!name.trim()) {
      alert('请输入角色名');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/character/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          visual: visual.trim() || undefined,
          model,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error || '生成失败');
        return;
      }

      const now = new Date().toISOString();
      const profile: CharacterProfile = {
        id: json.data.characterId,
        name: name.trim(),
        description: description.trim() || undefined,
        visual: visual.trim() || undefined,
        matchNames: parseMatchNames(matchNames, name.trim()),
        referenceImageUrl: json.data.imageUrl,
        sourceType: 'custom',
        createdAt: now,
        updatedAt: now,
      };
      upsertCharacter(profile);
      setCharacters(loadCharactersFromStorage());
      setView('groups');

      // reset
      setName('');
      setDescription('');
      setVisual('');
      setMatchNames('');
    } catch (e) {
      console.error(e);
      alert('生成失败，请检查网络');
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDelete(id: string) {
    if (!confirm('确定要删除这个角色吗？')) return;
    deleteCharacter(id);
    setCharacters(loadCharactersFromStorage());
  }

  function handleUpdateMatchNames(c: CharacterProfile, raw: string) {
    const next: CharacterProfile = {
      ...c,
      matchNames: parseMatchNames(raw, c.name),
      updatedAt: new Date().toISOString(),
    };
    upsertCharacter(next);
    setCharacters(loadCharactersFromStorage());
  }

  function handleMoveCharacter(c: CharacterProfile, target: string) {
    // target: "custom" or scriptId
    const now = new Date().toISOString();
    if (target === 'custom') {
      const next: CharacterProfile = {
        ...c,
        sourceType: 'custom',
        sourceScriptId: undefined,
        sourceScriptTitle: undefined,
        updatedAt: now,
      };
      upsertCharacter(next);
      setCharacters(loadCharactersFromStorage());
      return;
    }

    const script = scripts.find((s) => s.id === target);
    const next: CharacterProfile = {
      ...c,
      sourceType: 'script',
      sourceScriptId: target,
      sourceScriptTitle: script?.title || c.sourceScriptTitle || `脚本（${target}）`,
      updatedAt: now,
    };
    upsertCharacter(next);
    setCharacters(loadCharactersFromStorage());
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-block mb-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 bg-clip-text text-transparent mb-2 drop-shadow-lg">
            👥 角色库
          </h1>
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-full"></div>
        </div>
        <p className="text-gray-600 text-base font-medium">
          先生成“角色立绘/参考图”，再用于绘本生成的 <span className="font-bold">image_reference</span>，提升跨帧一致性
        </p>
      </div>

      {/* 上部：我的角色（按脚本分组） */}
      {view === 'groups' && (
        <div className="space-y-6">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-cyan-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">我的角色</h2>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 font-bold text-sm">
                {sortedAll.length}
              </span>
            </div>

            {(scriptGroups.length === 0 && customCharacters.length === 0 && uncategorized.length === 0) ? (
              <div className="text-center py-10 text-gray-600">还没有角色。你可以在下方新增自定义角色，或在“绘本生成”里一键生成角色立绘。</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scriptGroups.map((g) => (
                  <button
                    key={g.scriptId}
                    className="text-left border-2 border-cyan-200 rounded-xl p-4 bg-white hover:border-cyan-300 transition-colors"
                    onClick={() => {
                      setActiveGroup({ type: 'script', scriptId: g.scriptId, title: g.title });
                      setView('groupDetail');
                    }}
                  >
                    <div className="font-bold text-gray-800 truncate">{g.title}</div>
                    <div className="text-xs text-gray-500 mt-1">包含角色：{g.characters.length}</div>
                  </button>
                ))}

                <button
                  className="text-left border-2 border-purple-200 rounded-xl p-4 bg-white hover:border-purple-300 transition-colors"
                  onClick={() => {
                    setActiveGroup({ type: 'custom', title: '自定义角色' });
                    setView('groupDetail');
                  }}
                >
                  <div className="font-bold text-gray-800">自定义角色</div>
                  <div className="text-xs text-gray-500 mt-1">包含角色：{customCharacters.length + uncategorized.length}</div>
                </button>
              </div>
            )}
          </div>

          {/* 下部：新增自定义角色入口 */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-gray-800">新增角色</div>
                <div className="text-xs text-gray-500 mt-1">将角色添加到“自定义角色”中</div>
              </div>
              <button className="btn-primary" onClick={() => setView('create')}>
                新增自定义角色
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 组详情：点击脚本/自定义角色后显示具体角色 */}
      {view === 'groupDetail' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{activeGroup.title}</h2>
              <div className="text-xs text-gray-500 mt-1">点“返回”可回到脚本分组列表</div>
            </div>
            <button className="btn-secondary" onClick={() => setView('groups')}>返回</button>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-cyan-200">
            {(() => {
              const list =
                activeGroup.type === 'script'
                  ? (scriptGroups.find((g) => g.scriptId === activeGroup.scriptId)?.characters || [])
                  : [...customCharacters, ...uncategorized];

              if (list.length === 0) {
                return <div className="text-center py-10 text-gray-600">该分组下暂无角色。</div>;
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {list.map((c) => (
                    <div key={c.id} className="border-2 border-cyan-200 rounded-xl p-4 bg-white">
                      <div className="flex gap-4">
                        <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center border">
                          {c.referenceImageUrl ? (
                            <img src={c.referenceImageUrl} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-3xl">👤</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-gray-800 truncate">{c.name}</div>
                              {c.description && <div className="text-xs text-gray-600 mt-1 line-clamp-2">{c.description}</div>}
                              {c.visual && <div className="text-xs text-gray-500 mt-1 line-clamp-2">外观：{c.visual}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-gray-600 hover:text-gray-800 text-sm"
                                onClick={() => {
                                  setMoveOpenForId((prev) => {
                                    const next = prev === c.id ? null : c.id;
                                    if (next) {
                                      setMoveTargetById((m) => ({
                                        ...m,
                                        [c.id]: m[c.id] ?? (c.sourceType === 'custom' ? 'custom' : c.sourceScriptId || 'custom'),
                                      }));
                                    }
                                    return next;
                                  });
                                }}
                              >
                                移动
                              </button>
                              <button className="text-red-500 hover:text-red-600 text-sm" onClick={() => handleDelete(c.id)}>
                                删除
                              </button>
                            </div>
                          </div>

                          {moveOpenForId === c.id && (
                            <div className="mt-3 flex items-center gap-2">
                              <select
                                className="flex-1 p-2 border-2 border-gray-200 rounded-lg text-sm"
                                value={moveTargetById[c.id] ?? (c.sourceType === 'custom' ? 'custom' : c.sourceScriptId || 'custom')}
                                onChange={(e) => setMoveTargetById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              >
                                <option value="custom">自定义角色</option>
                                {scriptGroups.map((g) => (
                                  <option key={g.scriptId} value={g.scriptId}>
                                    {g.title}
                                  </option>
                                ))}
                                {scripts
                                  .filter((s) => !scriptGroups.some((g) => g.scriptId === s.id))
                                  .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
                                  .map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.title}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                className="text-xs px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
                                onClick={() => {
                                  const target = moveTargetById[c.id] ?? (c.sourceType === 'custom' ? 'custom' : c.sourceScriptId || 'custom');
                                  handleMoveCharacter(c, target);
                                  setMoveOpenForId(null);
                                }}
                              >
                                确定
                              </button>
                            </div>
                          )}

                          <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">匹配名（逗号分隔）</label>
                            <input
                              className="input-field"
                              defaultValue={(c.matchNames || [c.name]).join(',')}
                              onBlur={(e) => handleUpdateMatchNames(c, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        更新：{new Date(c.updatedAt || c.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 新增自定义角色：独立页面 */}
      {view === 'create' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">新增自定义角色（生成立绘）</h2>
            <button className="btn-secondary" onClick={() => setView('groups')}>返回</button>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-purple-200">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色名</label>
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：青风" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身份/关系/年龄（建议写清）</label>
                <textarea className="textarea-field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如：舅舅，成年男性，温柔耐心" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">外观要点（跨帧固定）</label>
                <textarea className="textarea-field" rows={3} value={visual} onChange={(e) => setVisual(e.target.value)} placeholder="例如：短黑发，蓝色外套+白T，戴手表，圆脸大眼" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">匹配名（用于对话 role 匹配，可选）</label>
                <input className="input-field" value={matchNames} onChange={(e) => setMatchNames(e.target.value)} placeholder="逗号分隔，例如：舅舅青风,青风叔叔" />
                <p className="text-xs text-gray-500 mt-1">默认会包含角色名本身；建议把“分镜/对话里可能出现的称呼”都加上。</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">立绘生成模型</label>
                <select className="w-full p-3 border-2 border-gray-200 rounded-lg" value={model} onChange={(e) => setModel(e.target.value as GenerationModel)}>
                  {PORTRAIT_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isGenerating}
                onClick={handleCreateAndGenerate}
              >
                {isGenerating ? '生成中...' : '生成角色立绘'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseMatchNames(raw: string, name: string): string[] {
  const parts = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const set = new Set<string>([name, ...parts]);
  return Array.from(set);
}

function extractRoleNamesFromScriptContent(content: string): Set<string> {
  const set = new Set<string>();
  try {
    const sb = extractStoryboardFromScript(content);
    if (sb && Array.isArray((sb as any).frames)) {
      for (const f of (sb as any).frames) {
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

  // 兜底：匹配 “角色：” 行
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([^：:\s]{1,20})\s*[：:]/);
    if (m?.[1]) set.add(m[1].trim());
  }
  return set;
}


