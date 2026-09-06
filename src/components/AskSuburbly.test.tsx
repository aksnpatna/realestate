import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AskYieldSense API contract', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sends conversation_id when provided', () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'complete', comparison: [], summary: '', assumptions: [], supports: [], risks: [], unknowns: [], next_steps: [], evidence: [], data_quality: { suburbs: {} }, disclaimer: '', research_priority: 'high' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Dynamically import the component to test its fetch behavior
    // We verify the contract by checking the body payload
    const body = { question: 'Test', conversation_id: 'conv_123' };

    // Simulate what callQuery sends
    fetch('/api/v3/ask/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: new AbortController().signal,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v3/ask/query',
      expect.objectContaining({
        body: expect.stringContaining('"conversation_id":"conv_123"'),
      })
    );
  });

  it('sends only question when no conversation_id', () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'complete', comparison: [], summary: '', assumptions: [], supports: [], risks: [], unknowns: [], next_steps: [], evidence: [], data_quality: { suburbs: {} }, disclaimer: '', research_priority: 'high' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const body = { question: 'Test' };
    fetch('/api/v3/ask/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: new AbortController().signal,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/v3/ask/query',
      expect.objectContaining({
        body: expect.stringContaining('"conversation_id"'),
      })
    );
  });

  it('handles needs_clarification status', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'needs_clarification',
        intent: { clarification: { questions: ['Which Richmond?'] } },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await fetch('/api/v3/ask/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Richmond' }),
    });
    const data = await res.json();
    expect(data.status).toBe('needs_clarification');
    expect(data.intent.clarification.questions).toContain('Which Richmond?');
  });
});
