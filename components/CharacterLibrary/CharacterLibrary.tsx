'use client';

import { useEffect, useMemo, useState } from 'react';
import { getActiveModels } from '@/lib/config/models';
import type { CharacterProfile, GenerationModel, Script } from '@/types';
import { deleteCharacter, loadCharactersFromStorage, upsertCharacter } from '@/lib/characterUtils';
import { loadScriptsFromStorage, extractStoryboardFromScript } from '@/lib/scriptUtils';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  MoveRight, 
  ChevronLeft,
  ChevronRight,
  Wand2,
  BookOpen, 
  Layers,
  Search,
  Check,
  User,
  Plus,
  RefreshCw,
  Sparkles
} from 'lucide-react';

export default function CharacterLibrary() {
  const PORTRAIT_MODELS = useMemo(() => 
    getActiveModels('image').map(m => ({ value: m.id as GenerationModel, label: m.name })),
  []);

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
  const [model, setModel] = useState<GenerationModel>('wan2.6-image');

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const chars = await loadCharactersFromStorage();
      const s = await loadScriptsFromStorage();
      setCharacters(chars);
      setScripts(s);
    };
    fetchData();
  }, []);

  const refreshCharacters = async () => {
    const chars = await loadCharactersFromStorage();
    setCharacters(chars);
  };

  const sortedAll = useMemo(() => {
    if (!Array.isArray(characters)) return [];
    return [...characters].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }, [characters]);

  const customCharacters = useMemo(() => {
    if (!Array.isArray(sortedAll)) return [];
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
    if (!Array.isArray(sortedAll) || !Array.isArray(scripts)) return [];
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
      await upsertCharacter(profile);
      await refreshCharacters();
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

  async function handleDelete(id: string) {
    if (!confirm('确定要删除这个角色吗？')) return;
    const success = await deleteCharacter(id);
    if (success) {
      await refreshCharacters();
    } else {
      alert('删除失败');
    }
  }

  async function handleUpdateMatchNames(c: CharacterProfile, raw: string) {
    const next: CharacterProfile = {
      ...c,
      matchNames: parseMatchNames(raw, c.name),
      updatedAt: new Date().toISOString(),
    };
    await upsertCharacter(next);
    await refreshCharacters();
  }

  async function handleMoveCharacter(c: CharacterProfile, target: string) {
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
      await upsertCharacter(next);
      await refreshCharacters();
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
    await upsertCharacter(next);
    await refreshCharacters();
  }

  async function handleUpdateVisual(c: CharacterProfile, visual: string) {
    const next: CharacterProfile = {
      ...c,
      visual: visual.trim(),
      updatedAt: new Date().toISOString(),
    };
    await upsertCharacter(next);
    await refreshCharacters();
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-2xl bg-primary-100 text-primary-600 shadow-sm shadow-primary-100">
              <Users size={32} />
            </div>
            <h1 className="text-4xl font-black text-slate-800 tracking-tight">
              角色管理中心
            </h1>
          </div>
          <div className="h-1.5 w-full bg-gradient-to-r from-primary-500 via-brand-violet to-primary-500 rounded-full opacity-20"></div>
        </div>
        <p className="mt-4 text-slate-500 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
          统一维护角色的视觉特征，确保每一帧漫画中角色的形象 <span className="text-primary-600 font-bold underline decoration-primary-200 decoration-4">始终如一</span>
        </p>
      </div>

      {/* 上部：我的角色（按脚本分组） */}
      {view === 'groups' && (
        <div className="space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Layers className="text-primary-500" size={24} />
                <h2 className="text-xl font-bold text-slate-800">角色分册</h2>
              </div>
              <span className="px-4 py-1.5 rounded-xl bg-primary-50 text-primary-600 font-black text-xs border border-primary-100/50 uppercase tracking-widest">
                {sortedAll.length} Total Units
              </span>
            </div>

            {(scriptGroups.length === 0 && customCharacters.length === 0 && uncategorized.length === 0) ? (
              <div className="text-center py-16 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                <Users size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-bold">角色库尚无记录</p>
                <p className="text-slate-400 text-sm mt-1 font-medium">您可以手动定妆，或在绘本生成时由 AI 自动同步</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {scriptGroups.map((g) => (
                  <button
                    key={g.scriptId}
                    className="group relative text-left border border-slate-100 rounded-2xl p-6 bg-slate-50/30 hover:bg-white hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300"
                    onClick={() => {
                      setActiveGroup({ type: 'script', scriptId: g.scriptId, title: g.title });
                      setView('groupDetail');
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-xl bg-white shadow-sm text-slate-400 group-hover:text-primary-600 transition-colors border border-slate-100">
                        <BookOpen size={18} />
                      </div>
                      <div className="font-bold text-slate-700 truncate group-hover:text-primary-700 transition-colors">{g.title}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-500">
                        {g.characters.length} Characters
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </button>
                ))}

                <button
                  className="group relative text-left border border-primary-100 rounded-2xl p-6 bg-primary-50/30 hover:bg-white hover:border-primary-300 hover:shadow-xl hover:shadow-primary-500/5 transition-all duration-300"
                  onClick={() => {
                    setActiveGroup({ type: 'custom', title: '自定义角色' });
                    setView('groupDetail');
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 rounded-xl bg-primary-100 text-primary-600 shadow-sm transition-colors">
                      <Users size={18} />
                    </div>
                    <div className="font-bold text-slate-800 group-hover:text-primary-700 transition-colors">独立角色库</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-primary-400 uppercase tracking-widest">
                      {customCharacters.length + uncategorized.length} Unique Units
                    </div>
                    <ChevronRight size={16} className="text-primary-300 group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* 下部：新增自定义角色入口 */}
          <div className="bg-gradient-to-r from-primary-600 to-brand-violet rounded-[2.5rem] shadow-2xl shadow-primary-500/10 p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
            
            <div className="flex items-center gap-8 relative z-10 text-center md:text-left">
              <div className="hidden sm:flex w-20 h-20 rounded-3xl bg-white/20 items-center justify-center backdrop-blur-md shadow-xl border border-white/20">
                <UserPlus size={36} />
              </div>
              <div>
                <h2 className="text-3xl font-black mb-2 tracking-tight">塑造专属角色形象</h2>
                <p className="text-primary-100 font-medium text-lg max-w-md">手动定妆并生成高清立绘，为绘本创作提供核心视觉资产</p>
              </div>
            </div>
            
            <button 
              className="relative z-10 whitespace-nowrap px-10 py-5 bg-white text-primary-600 rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3" 
              onClick={() => setView('create')}
            >
              <Plus size={24} />
              立即新增角色
            </button>
          </div>
        </div>
      )}

      {/* 组详情：点击脚本/自定义角色后显示具体角色 */}
      {view === 'groupDetail' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500" onClick={() => setView('groups')}>
                <ChevronLeft size={24} />
              </button>
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{activeGroup.title}</h2>
                <div className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Character Roster</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="hidden sm:inline text-xs font-bold text-slate-400 mr-2">Manage your story assets</span>
               <button className="btn-secondary !py-2 !px-4 flex items-center gap-2" onClick={() => setView('groups')}>
                 <Layers size={16} />
                 切换分组
               </button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-slate-100">
            {(() => {
              const list =
                activeGroup.type === 'script'
                  ? (scriptGroups.find((g) => g.scriptId === activeGroup.scriptId)?.characters || [])
                  : [...customCharacters, ...uncategorized];

              if (list.length === 0) {
                return (
                  <div className="text-center py-20">
                    <Users size={64} className="mx-auto text-slate-200 mb-6" />
                    <p className="text-slate-500 text-lg font-bold">该分组下暂无角色</p>
                    <p className="text-slate-400 mt-2">点击返回可以查看其他分组或新建角色</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {list.map((c) => (
                    <div key={c.id} className="group relative bg-slate-50/50 rounded-3xl p-6 border border-slate-100 hover:bg-white hover:border-primary-200 hover:shadow-2xl hover:shadow-primary-500/5 transition-all duration-500">
                      <div className="flex flex-col sm:flex-row gap-6">
                        <div className="relative shrink-0">
                          <div className="w-32 h-32 rounded-[2rem] bg-white overflow-hidden shadow-inner flex items-center justify-center border-4 border-white group-hover:border-primary-50 transition-all duration-500">
                            {c.referenceImageUrl ? (
                              <img src={c.referenceImageUrl} alt={c.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                              <User size={48} className="text-slate-200" />
                            )}
                          </div>
                          {c.referenceImageUrl && (
                             <div className="absolute -bottom-2 -right-2 bg-primary-500 text-white p-2 rounded-xl shadow-lg shadow-primary-500/30">
                               <Check size={14} strokeWidth={4} />
                             </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="min-w-0">
                              <h3 className="text-xl font-black text-slate-800 group-hover:text-primary-600 transition-colors truncate">{c.name}</h3>
                              {c.description && <p className="text-sm font-medium text-slate-500 mt-1 line-clamp-2 leading-relaxed">{c.description}</p>}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                className="p-2 text-slate-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-all"
                                title="移动到其他组"
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
                                <MoveRight size={18} />
                              </button>
                              <button 
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" 
                                title="从库中删除"
                                onClick={() => handleDelete(c.id)}
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="mt-auto space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-1.5 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">视觉锁定特征</label>
                                <Wand2 size={10} className="text-violet-400" />
                              </div>
                              <input
                                className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/5 transition-all outline-none shadow-sm"
                                defaultValue={c.visual || ''}
                                onBlur={(e) => handleUpdateVisual(c, e.target.value)}
                                placeholder="输入发型、服装、肤色等固定特征..."
                              />
                            </div>

                            {moveOpenForId === c.id && (
                              <div className="flex items-center gap-2 p-2 bg-primary-50/50 rounded-2xl border border-primary-100 animate-in zoom-in-95 duration-200">
                                <select
                                  className="flex-1 bg-transparent border-none text-xs font-bold text-primary-700 focus:ring-0 cursor-pointer"
                                  value={moveTargetById[c.id] ?? (c.sourceType === 'custom' ? 'custom' : c.sourceScriptId || 'custom')}
                                  onChange={(e) => setMoveTargetById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                >
                                  <option value="custom">移动至：自定义角色库</option>
                                  {scriptGroups.map((g) => (
                                    <option key={g.scriptId} value={g.scriptId}>移动至：{g.title}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="px-4 py-1.5 bg-primary-600 text-white text-[10px] font-black rounded-lg shadow-md active:scale-95 transition-all"
                                  onClick={() => {
                                    const target = moveTargetById[c.id] ?? (c.sourceType === 'custom' ? 'custom' : c.sourceScriptId || 'custom');
                                    handleMoveCharacter(c, target);
                                    setMoveOpenForId(null);
                                  }}
                                >
                                  确认
                                </button>
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between mb-1.5 px-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">匹配关键词</label>
                                <Search size={10} className="text-slate-300" />
                              </div>
                              <input
                                className="w-full px-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 focus:border-primary-400 focus:ring-4 focus:ring-primary-500/5 transition-all outline-none shadow-sm"
                                defaultValue={(c.matchNames || [c.name]).join(', ')}
                                onBlur={(e) => handleUpdateMatchNames(c, e.target.value)}
                                placeholder="输入脚本中可能出现的称呼..."
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-4 right-6 text-[10px] font-bold text-slate-300 pointer-events-none uppercase">
                        Updated {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
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
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-white rounded-xl transition-all shadow-sm border border-slate-100" onClick={() => setView('groups')}>
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">定妆新角色</h2>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary-500/5 p-10 border border-slate-100">
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700 uppercase tracking-wider ml-1">角色姓名</label>
                  <div className="relative group">
                    <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    <input className="input-field !pl-12" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：青风" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700 uppercase tracking-wider ml-1">匹配关键词</label>
                  <div className="relative group">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" />
                    <input className="input-field !pl-12" value={matchNames} onChange={(e) => setMatchNames(e.target.value)} placeholder="称呼，用逗号分隔" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-slate-700 uppercase tracking-wider ml-1">身份设定 (Identity)</label>
                <textarea className="textarea-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例如：舅舅，成年男性，温柔耐心" />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-black text-slate-700 uppercase tracking-wider ml-1">视觉特征 (Visual Assets)</label>
                <div className="relative group">
                  <Wand2 size={18} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                  <textarea className="textarea-field !pl-12" rows={3} value={visual} onChange={(e) => setVisual(e.target.value)} placeholder="例如：短黑发，蓝色外套+白T，戴手表，圆脸大眼" />
                </div>
                <p className="text-[10px] text-slate-400 font-bold ml-1">这些特征将作为强制约束注入 AI 提示词中</p>
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-700 uppercase tracking-wider ml-1 text-center">选择画风模型</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PORTRAIT_MODELS.slice(0, 4).map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setModel(m.value)}
                        className={`p-4 rounded-2xl border-2 text-sm font-bold transition-all ${
                          model === m.value 
                            ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md' 
                            : 'border-slate-100 hover:border-primary-200 text-slate-500'
                        }`}
                      >
                        {m.label.split('（')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="btn-primary w-full !py-5 rounded-2xl flex items-center justify-center gap-3 text-lg font-black shadow-xl shadow-primary-200"
                  disabled={isGenerating}
                  onClick={handleCreateAndGenerate}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw size={24} className="animate-spin" />
                      正在塑造形象...
                    </>
                  ) : (
                    <>
                      <Sparkles size={24} />
                      立即生成角色立绘
                    </>
                  )}
                </button>
              </div>
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


