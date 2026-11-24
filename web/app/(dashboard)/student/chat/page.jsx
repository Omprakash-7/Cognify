'use client';

import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/client-api';
import { streamChatQuery } from '@/lib/sse';
import { MathRenderer } from '@/components/MathRenderer';

export default function StudentChatPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('q') || '';
    }
    return '';
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [activeCitations, setActiveCitations] = useState([]);
  const [isSubmittingDoubt, setIsSubmittingDoubt] = useState(false);
  const [doubtSuccess, setDoubtSuccess] = useState('');
  const messagesEndRef = useRef(null);

  // Load batches on mount and parse search params
  useEffect(() => {
    let urlBatchId = '';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      urlBatchId = params.get('batchId') || '';
    }

    async function loadBatches() {
      try {
        const data = await apiRequest('/api/batches');
        if (data.batches && data.batches.length > 0) {
          setBatches(data.batches);
          const targetBatch = urlBatchId && data.batches.find((b) => b.id === urlBatchId);
          setSelectedBatchId(targetBatch ? targetBatch.id : data.batches[0].id);
        }
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load batches');
      }
    }
    loadBatches();
  }, []);

  // Load history when batch changes
  useEffect(() => {
    if (!selectedBatchId) return;
    async function loadHistory() {
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}/chat/history?limit=30`);
        if (data.messages) {
          // Sort messages chronologically
          const sorted = [...data.messages].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
          setMessages(sorted);
        }
      } catch (err) {
        // Not critical, continue with empty
      }
    }
    loadHistory();
  }, [selectedBatchId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  async function handleSend(e) {
    e?.preventDefault();
    const query = inputQuery.trim();
    if (!query || !selectedBatchId || isStreaming) return;

    setErrorBanner('');
    setInputQuery('');

    // Add user message to list
    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };

    // Prepare placeholder assistant message
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      citations: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setActiveCitations([]);

    try {
      await streamChatQuery(selectedBatchId, query, {
        onMeta: ({ citations }) => {
          if (citations && citations.length > 0) {
            setActiveCitations(citations);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, citations } : msg
              )
            );
          }
        },
        onToken: (chunk) => {
          const text = chunk?.token !== undefined ? chunk.token : chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: (msg.content || '') + text }
                : msg
            )
          );
        },
        onReplace: ({ text }) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: text, isFallback: true }
                : msg
            )
          );
        },
        onDone: () => {
          setIsStreaming(false);
        },
        onError: (err) => {
          setErrorBanner(err.message || 'Error streaming response');
          setIsStreaming(false);
        },
      });
    } catch (err) {
      setErrorBanner(err.message || 'Failed to start chat stream');
      setIsStreaming(false);
    }
  }

  async function handleRaiseDoubt(questionText) {
    if (!selectedBatchId || isSubmittingDoubt) return;
    setIsSubmittingDoubt(true);
    setDoubtSuccess('');
    try {
      await apiRequest(`/api/batches/${selectedBatchId}/tickets`, {
        method: 'POST',
        body: JSON.stringify({ question: questionText }),
      });
      setDoubtSuccess('Doubt ticket raised successfully! Your faculty will review it.');
      setTimeout(() => setDoubtSuccess(''), 5000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to raise doubt ticket');
    } finally {
      setIsSubmittingDoubt(false);
    }
  }

  async function handleViewCitationFile(documentId) {
    try {
      const data = await apiRequest(`/api/documents/${documentId}/file`);
      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to retrieve document link');
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Top Bar: Batch Selector & Vetted Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">smart_toy</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight">AI Study Assistant</h1>
            <p className="text-xs text-on-surface-variant">
              100% Grounded in your institute&apos;s verified lecture notes &amp; DPPs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Active Batch:
          </label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm font-medium text-on-surface focus:outline-none focus:border-primary"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.subject})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error or Success notification */}
      {errorBanner && (
        <div className="mt-2 p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between shrink-0">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {doubtSuccess && (
        <div className="mt-2 p-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{doubtSuccess}</span>
        </div>
      )}

      {/* Main Chat Stream Container */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary mb-3">
              <span className="material-symbols-outlined text-[32px]">psychology</span>
            </div>
            <h3 className="text-base font-semibold text-on-surface mb-1">
              Ask any concept, formula, or derivation
            </h3>
            <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
              Every answer is verified against your teacher&apos;s study material with inline citations and LaTeX math support.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Derive Newton's Second Law for variable mass",
                'Explain Lenz Law and conservation of energy',
                'What is the formula for terminal velocity?',
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputQuery(suggestion);
                  }}
                  className="px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant hover:text-primary hover:border-primary transition-colors"
                >
                  &ldquo;{suggestion}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isFallback =
              msg.isFallback ||
              msg.content?.toLowerCase().includes("couldn't find this in your batch's study material");

            return (
              <div
                key={msg.id || idx}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 text-sm ${
                    isUser
                      ? 'bg-primary text-on-primary rounded-tr-none'
                      : 'bg-surface-container-lowest border border-outline-variant/30 shadow-sm rounded-tl-none text-on-surface'
                  }`}
                >
                  {/* Content with LaTeX Math Renderer */}
                  <div className="leading-relaxed">
                    <MathRenderer content={msg.content || '...'} />
                  </div>

                  {/* Grounded Citations Section */}
                  {!isUser && msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/20">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Vetted Sources ({msg.citations.length}):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.citations.map((c, idx) => (
                          <div
                            key={idx}
                            onClick={() => handleViewCitationFile(c.documentId)}
                            className="p-2 rounded-lg bg-surface-container-low border border-outline-variant/30 hover:border-primary cursor-pointer transition-colors text-xs flex flex-col justify-between"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-medium text-on-surface truncate">
                                [{c.n || idx + 1}] {c.title || 'Lecture Document'}
                              </span>
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-surface-container-high text-[10px] font-semibold text-primary uppercase">
                                Pg {c.page || 1}
                              </span>
                            </div>
                            {c.snippet && (
                              <p className="text-[11px] text-on-surface-variant line-clamp-2 mt-1 italic">
                                &ldquo;{c.snippet}&rdquo;
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fallback Unanswered Warning & Raise Doubt Ticket CTA */}
                  {!isUser && isFallback && (
                    <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-error-container/20 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-error">
                        <span className="material-symbols-outlined text-[18px]">info</span>
                        <span>Not found in batch material</span>
                      </div>
                      <button
                        onClick={() => handleRaiseDoubt(messages[messages.indexOf(msg) - 1]?.content || msg.content)}
                        disabled={isSubmittingDoubt}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shrink-0 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">help_center</span>
                        <span>Raise Doubt Ticket</span>
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-on-secondary-fixed shrink-0 mt-0.5 font-bold text-xs">
                    You
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="pt-3 border-t border-outline-variant/30 shrink-0">
        <form onSubmit={handleSend} className="relative flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            disabled={isStreaming || !selectedBatchId}
            placeholder={
              !selectedBatchId
                ? 'Please join a batch first...'
                : 'Ask a doubt or formula derivation (e.g. "Explain Lenz Law in terms of energy")...'
            }
            className="flex-1 pl-4 pr-12 py-3 bg-surface-container-lowest border border-outline-variant/40 rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary shadow-sm"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || isStreaming || !selectedBatchId}
            className="absolute right-2 px-3 py-2 rounded-lg bg-primary text-on-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary-container transition-all flex items-center justify-center"
          >
            {isStreaming ? (
              <span className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="material-symbols-outlined text-[20px]">send</span>
            )}
          </button>
        </form>
        <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-2 px-1">
          <span>AI outputs are cross-verified with batch textbooks &amp; lecture notes</span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
}
