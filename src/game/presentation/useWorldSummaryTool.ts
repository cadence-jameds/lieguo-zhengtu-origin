import { useEffect, useRef } from 'react';

type Summary = { status: string; worldSize: number | null; cityCount: number; factionCount: number; worldTime: number | null };
type Context = { registerTool: (tool: {
  name: string; title: string; description: string; inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Summary;
}, options: { signal: AbortSignal }) => void | Promise<void> };

/** Read the same formal world shown in the UI; no commands or simulation writes. */
export function useWorldSummaryTool(summary: Summary) {
  const current = useRef(summary);
  useEffect(() => { current.current = summary; }, [summary]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: 'read_formal_world_summary', title: '讀取目前世界概況',
        description: '讀取目前畫面使用的正式世界狀態與城市數量；不建立新局或修改存檔。',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('此工具僅接受空物件。');
          return { ...current.current };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Browsers without WebMCP retain the normal UI. */ }
    return () => lifecycle.abort();
  }, []);
}
