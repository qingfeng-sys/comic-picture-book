'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CharacterProfile, GenerationModel } from '@/types';
import { deleteCharacter, loadCharactersFromStorage, upsertCharacter } from '@/lib/characterUtils';

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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visual, setVisual] = useState('');
  const [matchNames, setMatchNames] = useState(''); // 逗号分隔
  const [model, setModel] = useState<GenerationModel>('wan2.2-t2i-plus');

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setCharacters(loadCharactersFromStorage());
  }, []);

  const sorted = useMemo(() => {
    return [...characters].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }, [characters]);

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
        createdAt: now,
        updatedAt: now,
      };
      upsertCharacter(profile);
      setCharacters(loadCharactersFromStorage());

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-purple-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4">新增角色（生成立绘）</h2>

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

        <div className="lg:col-span-2">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl p-6 border-2 border-cyan-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">我的角色</h2>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 text-cyan-700 font-bold text-sm">
                {sorted.length}
              </span>
            </div>

            {sorted.length === 0 ? (
              <div className="text-center py-10 text-gray-600">
                还没有角色。先在左侧生成一个角色立绘吧。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sorted.map((c) => (
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
                          <button className="text-red-500 hover:text-red-600 text-sm" onClick={() => handleDelete(c.id)}>删除</button>
                        </div>

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
            )}
          </div>
        </div>
      </div>
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


