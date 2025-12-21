import type { CharacterProfile } from '@/types';

/**
 * 从数据库加载角色
 */
export async function loadCharactersFromStorage(): Promise<CharacterProfile[]> {
  try {
    const resp = await fetch('/api/character');
    if (!resp.ok) return [];
    const result = await resp.json();
    return (result.success && Array.isArray(result.data)) ? result.data : [];
  } catch (e) {
    console.error('加载角色库失败:', e);
    return [];
  }
}

/**
 * 保存/更新角色到数据库
 */
export async function upsertCharacter(character: CharacterProfile): Promise<CharacterProfile | null> {
  try {
    const resp = await fetch('/api/character', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: character.id,
        name: character.name,
        role: character.role,
        description: character.description,
        visual: character.visual,
        imageUrl: character.referenceImageUrl,
        // 新增字段
        sourceType: character.sourceType,
        sourceScriptId: character.sourceScriptId,
        sourceScriptTitle: character.sourceScriptTitle,
        matchNames: character.matchNames,
      }),
    });
    if (!resp.ok) return null;
    const result = await resp.json();
    return result.success ? result.data : null;
  } catch (e) {
    console.error('保存角色失败:', e);
    return null;
  }
}

/**
 * 删除角色
 */
export async function deleteCharacter(characterId: string): Promise<boolean> {
  try {
    const resp = await fetch(`/api/character?id=${characterId}`, { method: 'DELETE' });
    if (!resp.ok) return false;
    const result = await resp.json();
    return result.success;
  } catch (e) {
    console.error('删除角色失败:', e);
    return false;
  }
}
