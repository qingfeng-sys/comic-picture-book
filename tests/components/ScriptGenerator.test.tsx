import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScriptGenerator from '@/components/ScriptGenerator/ScriptGenerator';

// mock storage interactions
vi.mock('@/lib/scriptUtils', () => ({
  loadScriptsFromStorage: vi.fn(() => []),
  saveScriptToStorage: vi.fn(),
  createScriptWithSegments: vi.fn((title: string, content: string) => ({
    id: 'script_1',
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    segments: [],
    totalSegments: 0,
  })),
}));

describe('ScriptGenerator component', () => {
  it('renders input area', () => {
    render(
      <ScriptGenerator
        onScriptComplete={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText(/生成故事脚本/i)).toBeInTheDocument();
  });
});

