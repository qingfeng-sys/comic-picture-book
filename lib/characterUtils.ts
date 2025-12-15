import type { CharacterProfile } from '@/types';

const STORAGE_KEY = 'comic_characters';

export function loadCharactersFromStorage(): CharacterProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CharacterProfile[]) : [];
  } catch (e) {
    console.error('加载角色库失败:', e);
    return [];
  }
}

export function saveCharactersToStorage(characters: CharacterProfile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
  } catch (e) {
    console.error('保存角色库失败:', e);
  }
}

export function upsertCharacter(character: CharacterProfile): void {
  const list = loadCharactersFromStorage();
  const idx = list.findIndex(c => c.id === character.id);
  const next = idx >= 0 ? [...list.slice(0, idx), character, ...list.slice(idx + 1)] : [character, ...list];
  saveCharactersToStorage(next);
}

export function deleteCharacter(characterId: string): void {
  const list = loadCharactersFromStorage();
  saveCharactersToStorage(list.filter(c => c.id !== characterId));
}


