'use client';

import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/client-api';
import { MathRenderer } from '@/components/MathRenderer';

function ArtifactPreview({ item }) {
  const t = item?.item_type || item?.type || '';
  const c = item?.content;

  if (!c) return <span className="text-on-surface-variant italic">No content available</span>;

  if (typeof c === 'string') {
    return <MathRenderer content={c} />;
  }

  if (typeof c.markdown === 'string') {
    return <MathRenderer content={c.markdown} />;
  }

  // Notes: sections with bullets
  if (t === 'notes' && Array.isArray(c.sections)) {
    return (
      <div className="space-y-4">
        {c.sections.map((sec, si) => (
          <div key={si} className="space-y-1.5 border-b border-outline-variant/15 pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between text-xs font-bold text-primary">
              <span>{sec.title || sec.heading || `Section ${si + 1}`}</span>
              {Array.isArray(sec.pages) && sec.pages.length > 0 && (
                <span className="text-[10px] text-on-surface-variant">p.{sec.pages.join(', ')}</span>
              )}
            </div>
            {Array.isArray(sec.bullets) && (
              <ul className="list-disc pl-4 space-y-1 text-xs text-on-surface">
                {sec.bullets.map((b, bi) => (
                  <li key={bi}><MathRenderer content={typeof b === 'string' ? b : b.text || JSON.stringify(b)} /></li>
                ))}
              </ul>
            )}
            {sec.body && !sec.bullets && (
              <div className="text-xs text-on-surface"><MathRenderer content={sec.body} /></div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Summary: overview + sections
  if (t === 'summary') {
    return (
      <div className="space-y-3">
        {c.overview && (
          <div className="p-3 rounded-lg bg-surface-container-high text-xs text-on-surface">
            <strong className="block text-primary mb-1">Executive Overview:</strong>
            <MathRenderer content={c.overview} />
          </div>
        )}
        {Array.isArray(c.sections) && (
          <div className="space-y-2">
            {c.sections.map((sec, si) => (
              <div key={si} className="text-xs text-on-surface">
                <strong className="text-on-surface font-semibold">{sec.heading}: </strong>
                <span>{sec.summary}</span>
              </div>
            ))}
          </div>
        )}
        {Array.isArray(c.keyFindings) && (
          <ul className="list-disc pl-4 space-y-1 text-xs text-on-surface">
            {c.keyFindings.map((kf, ki) => (
              <li key={ki}>{typeof kf === 'string' ? kf : kf.text || ''}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Key Points: list of points with why it matters
  if (t === 'key_points') {
    const points = Array.isArray(c.points) ? c.points : Array.isArray(c) ? c : [];
    return (
      <div className="space-y-2">
        {points.map((pt, pi) => (
          <div key={pi} className="flex items-start gap-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
              {pi + 1}
            </span>
            <div className="flex-1 space-y-0.5">
              <div className="font-medium text-on-surface">
                <MathRenderer content={typeof pt === 'string' ? pt : pt.point || pt.text || ''} />
              </div>
              {pt.whyItMatters && (
                <div className="text-[11px] text-on-surface-variant italic">
                  <span className="font-semibold text-primary not-italic">Why it matters: </span>
                  {pt.whyItMatters}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Quiz: questions + options + correct index
  if (t === 'quiz') {
    const questions = Array.isArray(c.questions) ? c.questions : [];
    return (
      <div className="space-y-3">
        {questions.map((q, qi) => (
          <div key={qi} className="p-3 rounded-lg bg-surface-container border border-outline-variant/20 space-y-2 text-xs">
            <div className="font-semibold text-on-surface flex items-start gap-2">
              <span className="text-primary font-bold">Q{qi + 1}.</span>
              <MathRenderer content={q.question} />
            </div>
            {Array.isArray(q.options) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-4">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctIndex;
                  return (
                    <div
                      key={oi}
                      className={`p-1.5 rounded flex items-center gap-1.5 ${
                        isCorrect
                          ? 'bg-tertiary-fixed font-semibold text-on-tertiary-fixed'
                          : 'text-on-surface-variant'
                      }`}
                    >
                      <span>({String.fromCharCode(65 + oi)})</span>
                      <MathRenderer content={opt} />
                      {isCorrect && <span className="ml-auto text-[10px] uppercase font-bold">✓ Correct</span>}
                    </div>
                  );
                })}
              </div>
            )}
            {q.explanation && (
              <div className="text-[11px] text-on-surface-variant pl-4 italic">
                <span className="font-semibold not-italic">Explanation: </span>{q.explanation}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Flashcards: front & back list
  if (t === 'flashcards') {
    const cards = Array.isArray(c.cards) ? c.cards : Array.isArray(c) ? c : [];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cards.map((card, ci) => (
          <div key={ci} className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/20 space-y-1 text-xs">
            <div className="font-semibold text-primary flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-outline">Front:</span>
              <MathRenderer content={card.front || card.term || card.question || ''} />
            </div>
            <div className="text-on-surface flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-outline">Back:</span>
              <MathRenderer content={card.back || card.definition || card.answer || ''} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <pre className="text-xs font-mono bg-surface-container-high p-3 rounded-lg overflow-x-auto text-on-surface whitespace-pre-wrap">
      {JSON.stringify(c, null, 2)}
    </pre>
  );
}

export default function TeacherReviewWorkspacePage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // all | notes | summary | key_points | quiz | flashcards

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const fileInputRef = useRef(null);

  // Edit item state
  const [editingItem, setEditingItem] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContentText, setEditContentText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Polling ref for document processing
  const pollingRef = useRef(null);

  // 1. Load batches on mount
  useEffect(() => {
    async function initBatches() {
      try {
        const data = await apiRequest('/api/batches');
        if (data.batches && data.batches.length > 0) {
          setBatches(data.batches);
          setSelectedBatchId(data.batches[0].id);
        }
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load batches');
      }
    }
    initBatches();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // 2. Load documents when batch changes
  useEffect(() => {
    let active = true;
    if (!selectedBatchId) return;
    (async () => {
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}/documents`);
        const docs = data.documents || [];
        if (active) {
          setDocuments(docs);
          if (docs.length > 0) {
            setSelectedDocId((prev) => (docs.some((d) => d.id === prev) ? prev : docs[0].id));
          } else {
            setSelectedDocId('');
          }
        }
      } catch (err) {
        if (active) setErrorBanner(err.message || 'Failed to load documents');
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedBatchId]);

  async function loadDocuments(batchId) {
    try {
      const data = await apiRequest(`/api/batches/${batchId}/documents`);
      const docs = data.documents || [];
      setDocuments(docs);
      if (docs.length > 0) {
        if (!docs.some((d) => d.id === selectedDocId)) {
          setSelectedDocId(docs[0].id);
        }
      } else {
        setSelectedDocId('');
        setItems([]);
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to load documents');
    }
  }

  // 3. Load items when document changes
  useEffect(() => {
    let active = true;
    if (!selectedDocId) return;
    (async () => {
      try {
        const data = await apiRequest(`/api/documents/${selectedDocId}/items`);
        if (active) setItems(data.items || []);
      } catch (err) {
        if (active) setErrorBanner(err.message || 'Failed to load document items');
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedDocId]);

  async function loadItems(docId) {
    setIsLoading(true);
    try {
      const data = await apiRequest(`/api/documents/${docId}/items`);
      setItems(data.items || []);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to load document items');
    } finally {
      setIsLoading(false);
    }
  }

  // Handle 2-Step Signed Document Upload
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedBatchId) return;

    // Reset input
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'ppt') {
      setErrorBanner('Legacy .ppt format is not supported. Please save as modern .pptx or export to .pdf before uploading.');
      return;
    }
    const allowed = ['pdf', 'pptx', 'docx', 'txt'];
    if (!allowed.includes(ext)) {
      setErrorBanner('Unsupported file type. Please upload a PPTX, PDF, DOCX, or TXT file.');
      return;
    }

    setIsUploading(true);
    setErrorBanner('');
    setUploadProgressText('Requesting signed upload URL...');

    try {
      // Step 1: Request signed upload URL
      const step1 = await apiRequest(`/api/batches/${selectedBatchId}/documents`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileType: ext,
          sizeBytes: file.size,
          title: file.name.replace(/\.[^/.]+$/, ''),
        }),
      });

      const docId = step1.documentId || step1.document?.id || step1.id;
      const uploadUrl = step1.uploadUrl;
      if (!docId || !uploadUrl) {
        throw new Error('Upload initialization failed: missing documentId or uploadUrl');
      }

      setUploadProgressText('Uploading file binary to secure storage...');

      // Step 2: PUT raw binary directly to uploadUrl
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        throw new Error(`Upload to storage failed (${uploadRes.status}): ${errText}`);
      }

      setUploadProgressText('Enqueuing background processing pipeline...');

      // Step 3: Complete upload
      await apiRequest(`/api/documents/${docId}/complete`, { method: 'POST' });

      setSuccessBanner(`Upload complete! Document "${file.name}" is queued for processing.`);
      await loadDocuments(selectedBatchId);
      setSelectedDocId(docId);

      // Start polling status
      pollDocumentStatus(docId);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  }

  function pollDocumentStatus(docId) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const data = await apiRequest(`/api/documents/${docId}`);
        const currentDoc = data.document || data;
        if (currentDoc.status === 'ready' || currentDoc.status === 'failed') {
          clearInterval(pollingRef.current);
          loadDocuments(selectedBatchId);
          loadItems(docId);
          if (currentDoc.status === 'ready') {
            setSuccessBanner('Document chunking & vector indexing complete!');
          } else {
            setErrorBanner(`Document processing failed: ${currentDoc.error_message || 'Unknown error'}`);
          }
        }
      } catch {
        clearInterval(pollingRef.current);
      }
    }, 2500);
  }

  async function handleReprocess(docId) {
    if (!confirm('Reprocess this document? Existing generated drafts will be marked stale.')) return;
    try {
      await apiRequest(`/api/documents/${docId}/reprocess`, { method: 'POST' });
      setSuccessBanner('Reprocessing queued for document.');
      loadDocuments(selectedBatchId);
      pollDocumentStatus(docId);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to reprocess document');
    }
  }

  async function handleGenerate(docId) {
    try {
      await apiRequest(`/api/documents/${docId}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          types: ['summary', 'notes', 'key_points', 'quiz', 'flashcards'],
        }),
      });
      setSuccessBanner('AI Generation jobs dispatched! Artifacts will appear as drafts.');
      setTimeout(() => loadItems(docId), 3000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to trigger artifact generation');
    }
  }

  async function handleApprove(itemId) {
    try {
      await apiRequest(`/api/items/${itemId}/approve`, { method: 'POST' });
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'approved' } : it))
      );
      setSuccessBanner('Artifact approved and published to students!');
      setTimeout(() => setSuccessBanner(''), 3000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to approve item');
    }
  }

  async function handleReject(itemId) {
    try {
      await apiRequest(`/api/items/${itemId}/reject`, { method: 'POST' });
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'rejected' } : it))
      );
      setSuccessBanner('Artifact marked as rejected.');
      setTimeout(() => setSuccessBanner(''), 3000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to reject item');
    }
  }

  async function handleDeleteDraft(itemId) {
    if (!confirm('Delete this draft item permanently?')) return;
    try {
      await apiRequest(`/api/items/${itemId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setSuccessBanner('Draft deleted.');
      setTimeout(() => setSuccessBanner(''), 3000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to delete item');
    }
  }

  function handleStartEdit(item) {
    setEditingItem(item);
    setEditTitle(item.title || '');
    setEditContentText(
      typeof item.content === 'string'
        ? item.content
        : JSON.stringify(item.content, null, 2)
    );
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingItem || isSavingEdit) return;

    let parsedContent;
    try {
      parsedContent = JSON.parse(editContentText);
    } catch {
      // If not JSON, use as markdown or text
      parsedContent = { markdown: editContentText };
    }

    setIsSavingEdit(true);
    setErrorBanner('');
    try {
      const res = await apiRequest(`/api/items/${editingItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editTitle.trim(),
          content: parsedContent,
        }),
      });
      setItems((prev) =>
        prev.map((it) => (it.id === editingItem.id ? res.item || { ...it, title: editTitle, content: parsedContent } : it))
      );
      setEditingItem(null);
      setSuccessBanner('Artifact updated successfully.');
      setTimeout(() => setSuccessBanner(''), 3000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to save item edits');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDownloadSourceFile(docId) {
    try {
      const data = await apiRequest(`/api/documents/${docId}/file`);
      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to retrieve download link');
    }
  }

  async function handleDeleteDocument(docId) {
    if (!docId) return;
    if (
      !confirm(
        'Are you sure you want to permanently delete this document and all its generated notes, quizzes, and flashcards?'
      )
    ) {
      return;
    }
    setErrorBanner('');
    try {
      await apiRequest(`/api/documents/${docId}`, { method: 'DELETE' });
      setSuccessBanner('Document and all associated study materials deleted successfully.');
      const remainingDocs = documents.filter((d) => d.id !== docId);
      setDocuments(remainingDocs);
      if (selectedDocId === docId) {
        if (remainingDocs.length > 0) {
          setSelectedDocId(remainingDocs[0].id);
        } else {
          setSelectedDocId('');
          setItems([]);
        }
      }
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to delete document');
    }
  }

  const selectedDoc = documents.find((d) => d.id === selectedDocId);
  const filteredItems = items.filter((it) => {
    if (activeTab === 'all') return true;
    return (it.item_type || it.type) === activeTab;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">
            Document &amp; Drafts Review Vault
          </h1>
          <p className="text-xs text-on-surface-variant">
            Upload course materials, supervise AI generation jobs, and review drafts before publishing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Batch:
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

      {errorBanner && (
        <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} className="font-bold underline ml-2">
            Dismiss
          </button>
        </div>
      )}

      {successBanner && (
        <div className="p-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successBanner}</span>
        </div>
      )}

      {/* 2-Column: Left Documents & Upload / Right Items Review */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT COLUMN: Upload Dropzone & Document Selector (4 cols) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Upload Dropzone */}
          <div className="p-5 rounded-2xl border-2 border-dashed border-outline-variant/50 bg-surface-container-lowest text-center space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.pptx,.docx,.txt"
              className="hidden"
            />
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
            </div>
            <div>
              <h4 className="text-sm font-bold text-on-surface">Upload Syllabus Material</h4>
              <p className="text-[11px] text-on-surface-variant mt-1">
                PDF, PPTX, DOCX, or TXT up to 25 MB
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-container disabled:opacity-50 text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
            >
              {isUploading ? (
                <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Select File</span>
                </>
              )}
            </button>

            {isUploading && (
              <p className="text-[11px] text-primary font-medium animate-pulse">
                {uploadProgressText}
              </p>
            )}
          </div>

          {/* Document List */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-on-surface">Course Documents ({documents.length})</h3>

            {documents.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-4">
                No documents uploaded for this batch yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {documents.map((doc) => {
                  const isSelected = doc.id === selectedDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary bg-surface-container-high text-primary shadow-sm'
                          : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-container text-on-surface'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-semibold text-xs truncate max-w-[170px]">
                          {doc.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            doc.status === 'ready'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : doc.status === 'processing'
                              ? 'bg-secondary-container text-on-secondary-fixed animate-pulse'
                              : 'bg-error-container text-on-error-container'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-1.5">
                        <span className="flex items-center gap-1.5">
                          <span>{doc.file_type?.toUpperCase()}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDocument(doc.id);
                          }}
                          className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
                          title="Delete Document"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Document Actions & Items Review (8 cols) */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {selectedDoc ? (
            <>
              {/* Document Status Header Card */}
              <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-on-surface">{selectedDoc.title}</h2>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedDoc.status === 'ready'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                          : selectedDoc.status === 'processing'
                          ? 'bg-secondary-container text-on-secondary-fixed'
                          : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      {selectedDoc.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Uploaded: {new Date(selectedDoc.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadSourceFile(selectedDoc.id)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-primary text-xs font-semibold border border-outline-variant/30 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">file_open</span>
                    <span>View PDF</span>
                  </button>
                  <button
                    onClick={() => handleReprocess(selectedDoc.id)}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-semibold border border-outline-variant/30 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Reprocess</span>
                  </button>
                  <button
                    onClick={() => handleGenerate(selectedDoc.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                    <span>Generate Artifacts</span>
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(selectedDoc.id)}
                    className="px-3 py-1.5 rounded-lg text-error hover:bg-error-container text-xs font-semibold border border-error/30 transition-colors flex items-center gap-1"
                    title="Permanently delete this document and its study materials"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Items Review Filters */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'All Artifacts' },
                  { id: 'notes', label: 'Notes' },
                  { id: 'summary', label: 'Summaries' },
                  { id: 'key_points', label: 'Key Points' },
                  { id: 'quiz', label: 'DPP Quizzes' },
                  { id: 'flashcards', label: 'Flashcards' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Items List */}
              {isLoading ? (
                <div className="p-12 text-center text-xs text-on-surface-variant">Loading artifacts...</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-10 text-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest">
                  <span className="material-symbols-outlined text-[40px] text-outline-variant mb-2">
                    description
                  </span>
                  <p className="text-xs text-on-surface-variant">
                    No items found for this filter. Click &ldquo;Generate Artifacts&rdquo; to build notes &amp; quizzes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-bold text-primary uppercase">
                            {(item.item_type || item.type || '').replace('_', ' ')}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                              item.status === 'approved'
                                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                : item.status === 'rejected'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-secondary-container text-on-secondary-fixed'
                            }`}
                          >
                            {item.status}
                          </span>
                          {item.is_stale && (
                            <span className="px-1.5 py-0.5 rounded bg-error/10 text-error text-[10px] font-bold">
                              Stale
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          {item.status !== 'approved' && (
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="px-2.5 py-1 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed hover:opacity-90 text-xs font-semibold flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">check</span>
                              <span>Approve</span>
                            </button>
                          )}
                          {item.status !== 'rejected' && (
                            <button
                              onClick={() => handleReject(item.id)}
                              className="px-2.5 py-1 rounded-lg bg-error-container text-on-error-container hover:opacity-90 text-xs font-semibold flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                              <span>Reject</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                            title="Edit Draft Content"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          {item.status === 'draft' && (
                            <button
                              onClick={() => handleDeleteDraft(item.id)}
                              className="p-1 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container"
                              title="Delete Draft"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className="text-sm font-bold text-on-surface">{item.title}</h4>

                      {/* Content preview */}
                      <div className="text-xs text-on-surface-variant bg-surface-container-low p-4 rounded-xl max-h-72 overflow-y-auto">
                        <ArtifactPreview item={item} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="p-16 text-center text-xs text-on-surface-variant border border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-lowest">
              Select or upload a document on the left to review generated drafts.
            </div>
          )}
        </div>
      </div>

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Edit Artifact Content</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Content (Markdown or JSON)
                </label>
                <textarea
                  rows={10}
                  value={editContentText}
                  onChange={(e) => setEditContentText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSavingEdit ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
