'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';

/* ─── tiny markdown→HTML renderer (no external dep) ─── */
function md(text = '') {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-surface-container px-1 rounded text-xs font-mono">$1</code>');
}

/* ─── Page badge ─── */
function PageBadge({ pages }) {
  if (!pages || pages.length === 0) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
      <span className="material-symbols-outlined text-[12px]">menu_book</span>
      p.{pages.join(', ')}
    </span>
  );
}

/* ─── NOTES renderer ─── */
function NotesRenderer({ content }) {
  const sections = content?.sections || [];
  if (!sections.length) return <RawFallback content={content} />;
  return (
    <div className="space-y-8">
      {sections.map((sec, si) => (
        <div key={si} className="bg-white/60 dark:bg-surface-container-low/60 rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
          {/* Section header */}
          <div className="flex items-center justify-between gap-2 px-5 py-3 bg-primary/5 border-b border-outline-variant/20">
            <h3 className="font-bold text-sm text-on-surface tracking-tight">
              {sec.title || sec.heading || `Chapter ${si + 1}`}
            </h3>
            <PageBadge pages={sec.pages} />
          </div>
          {/* Bullets */}
          {Array.isArray(sec.bullets) && sec.bullets.length > 0 && (
            <ul className="divide-y divide-outline-variant/10">
              {sec.bullets.map((b, bi) => (
                <li key={bi} className="flex items-start gap-3 px-5 py-3 hover:bg-surface-container-lowest/50 transition-colors">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  <span
                    className="text-sm text-on-surface leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: md(typeof b === 'string' ? b : b.text || JSON.stringify(b)) }}
                  />
                </li>
              ))}
            </ul>
          )}
          {/* Body fallback */}
          {sec.body && !sec.bullets && (
            <p className="px-5 py-4 text-sm text-on-surface leading-relaxed"
              dangerouslySetInnerHTML={{ __html: md(sec.body) }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── SUMMARY renderer ─── */
function SummaryRenderer({ content }) {
  return (
    <div className="space-y-6">
      {content?.overview && (
        <div className="p-5 rounded-2xl bg-secondary/10 border border-secondary/20">
          <div className="flex items-center gap-2 mb-2 text-secondary font-semibold text-xs uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px]">summarize</span>
            Executive Overview
          </div>
          <p className="text-sm text-on-surface leading-relaxed">{content.overview}</p>
        </div>
      )}

      {Array.isArray(content?.sections) && content.sections.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Chapter Summaries</h4>
          {content.sections.map((sec, i) => (
            <div key={i} className="rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between gap-2 px-5 py-3 bg-surface-container-low border-b border-outline-variant/20">
                <h5 className="font-semibold text-sm text-on-surface">{sec.heading || `Section ${i + 1}`}</h5>
                <PageBadge pages={sec.pages} />
              </div>
              <p className="px-5 py-4 text-sm text-on-surface leading-relaxed">{sec.summary}</p>
            </div>
          ))}
        </div>
      )}

      {/* keyFindings fallback */}
      {Array.isArray(content?.keyFindings) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Core Takeaways</h4>
          <ul className="list-disc pl-6 space-y-1.5">
            {content.keyFindings.map((kf, i) => (
              <li key={i} className="text-sm text-on-surface">{typeof kf === 'string' ? kf : kf.text || ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── KEY POINTS renderer ─── */
function KeyPointsRenderer({ content }) {
  const points = Array.isArray(content?.points)
    ? content.points
    : Array.isArray(content)
      ? content
      : [];

  if (!points.length) return <RawFallback content={content} />;

  return (
    <div className="space-y-3">
      {points.map((pt, i) => {
        const text = typeof pt === 'string' ? pt : pt.point || pt.text || '';
        const why = pt.whyItMatters || '';
        const pages = pt.pages || [];
        return (
          <div key={i} className="rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
            <div className="flex items-start gap-3 px-5 py-4">
              <span className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 space-y-1.5">
                <p
                  className="text-sm font-medium text-on-surface leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: md(text) }}
                />
                {why && (
                  <p className="text-xs text-on-surface-variant italic border-l-2 border-primary/30 pl-3">
                    <strong className="text-primary not-italic">Why it matters: </strong>{why}
                  </p>
                )}
              </div>
              <PageBadge pages={pages} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Raw JSON fallback ─── */
function RawFallback({ content }) {
  return (
    <pre className="text-xs font-mono bg-surface-container p-4 rounded-xl overflow-x-auto text-on-surface-variant whitespace-pre-wrap">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

/* ─── Route-level tab config ─── */
const TABS = [
  { id: 'notes',      label: 'Chapter Notes',       icon: 'description',  apiType: 'notes'      },
  { id: 'summary',    label: 'Executive Summary',    icon: 'auto_stories', apiType: 'summary'    },
  { id: 'key_points', label: 'High-Yield Points',    icon: 'checklist',    apiType: 'key_points' },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════ */
export default function StudentStudyReaderPage() {
  const [batches,         setBatches]         = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [activeTab,       setActiveTab]       = useState('notes');
  const [items,           setItems]           = useState([]);
  const [selectedItemId,  setSelectedItemId]  = useState(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [errorBanner,     setErrorBanner]     = useState('');

  /* load batches */
  useEffect(() => {
    apiRequest('/api/batches')
      .then((data) => {
        const list = data.batches || [];
        setBatches(list);
        if (list.length > 0) setSelectedBatchId(list[0].id);
      })
      .catch((err) => setErrorBanner(err.message || 'Failed to load batches'));
  }, []);

  /* load items whenever batch or tab changes */
  useEffect(() => {
    if (!selectedBatchId) return;
    let active = true;
    async function load() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}/items?type=${activeTab}`);
        if (!active) return;
        const list = data.items || [];
        setItems(list);
        setSelectedItemId(list.length > 0 ? list[0].id : null);
      } catch (err) {
        if (active) setErrorBanner(err.message || 'Failed to load items');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [selectedBatchId, activeTab]);

  const selectedItem = items.find((it) => it.id === selectedItemId);

  async function handleOpenDocument(docId) {
    try {
      const data = await apiRequest(`/api/documents/${docId}/file`);
      if (data.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (err) {
      setErrorBanner(err.message || 'Could not open source document');
    }
  }

  /* pick the right renderer based on item_type */
  function renderContent(item) {
    if (!item) return null;
    const c = item.content;
    const t = item.item_type || item.type || '';
    if (t === 'notes')      return <NotesRenderer     content={c} />;
    if (t === 'summary')    return <SummaryRenderer   content={c} />;
    if (t === 'key_points') return <KeyPointsRenderer content={c} />;
    return <RawFallback content={c} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)]">

      {/* ── Header ── */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">menu_book</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight">AI Study Notebook</h1>
            <p className="text-xs text-on-surface-variant">
              Faculty-approved notes, summaries &amp; high-yield points — grounded in your batch material
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Batch:</label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm font-medium text-on-surface focus:outline-none focus:border-primary"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {errorBanner && (
        <div className="no-print mt-2 p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between shrink-0">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="no-print flex items-center gap-1 pt-3 border-b border-outline-variant/20 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all rounded-t-lg ${
              activeTab === tab.id
                ? 'border-primary text-primary font-semibold bg-primary/5'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 2-Column Reader ── */}
      <div className="flex-1 grid grid-cols-12 gap-5 pt-4 overflow-hidden">

        {/* Left sidebar — item list */}
        <div className="no-print col-span-12 md:col-span-4 lg:col-span-3 border-r border-outline-variant/20 pr-3 overflow-y-auto space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px] animate-spin text-primary">progress_activity</span>
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/40 rounded-2xl mt-4">
              <span className="material-symbols-outlined text-[32px] text-outline-variant block mb-2">folder_open</span>
              No approved {activeTab.replace('_', ' ')} for this batch yet.
            </div>
          ) : (
            items.map((item) => {
              const sel = item.id === selectedItemId;
              const docTitle = item.title || item.document_title || 'Untitled';
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    sel
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'bg-surface-container-lowest border-outline-variant/30 hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h4 className={`font-semibold text-sm line-clamp-2 ${sel ? 'text-primary' : 'text-on-surface'}`}>
                      {docTitle}
                    </h4>
                    <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[9px] font-bold uppercase">
                      Vetted
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                    <span>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right — reader pane */}
        <div className="printable-document col-span-12 md:col-span-8 lg:col-span-9 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 overflow-y-auto shadow-sm">
          {selectedItem ? (
            <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-6">

              {/* Doc header */}
              <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-outline-variant/30">
                <div>
                  <h2 className="text-2xl font-extrabold text-on-surface tracking-tight leading-snug">
                    {selectedItem.title || selectedItem.document_title || 'Study Material'}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1 text-green-600 font-semibold">
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                      Faculty Approved
                    </span>
                    <span>•</span>
                    <span className="capitalize">{(selectedItem.item_type || activeTab).replace('_', ' ')}</span>
                    <span>•</span>
                    <span>Updated {selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : 'Recently'}</span>
                  </div>
                </div>

                <div className="no-print flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-medium text-xs shadow-sm transition-colors"
                    title="Print or Save as PDF"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    Print / Save as PDF
                  </button>

                  {selectedItem.document_id && (
                    <button
                      onClick={() => handleOpenDocument(selectedItem.document_id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-primary font-medium text-xs border border-outline-variant/30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">file_open</span>
                      View Source PDF
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="text-on-surface">
                {renderContent(selectedItem)}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-variant p-8">
              <span className="material-symbols-outlined text-[56px] text-outline-variant mb-3">article</span>
              <p className="text-sm font-medium">Select a document from the sidebar</p>
              <p className="text-xs mt-1 text-outline-variant">Notes, summaries &amp; key points will appear here</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
