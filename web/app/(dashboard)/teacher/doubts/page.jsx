'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';
import { MathRenderer } from '@/components/MathRenderer';

export default function TeacherDoubtTriagePage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [tickets, setTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('open'); // open | answered | closed | all

  // Answer state
  const [answeringTicket, setAnsweringTicket] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [modalError, setModalError] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  // Load batches and tickets on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const batchRes = await apiRequest('/api/batches');
        setBatches(batchRes.batches || []);
        loadTickets();
      } catch (err) {
        setErrorBanner(err.message || 'Failed to initialize tickets');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  async function loadTickets() {
    try {
      const data = await apiRequest('/api/tickets');
      setTickets(data.tickets || []);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to load tickets');
    }
  }

  async function handleSubmitAnswer(e) {
    e.preventDefault();
    if (!answeringTicket || !answerText.trim() || isSubmittingAnswer) return;

    setIsSubmittingAnswer(true);
    setModalError('');
    setErrorBanner('');
    try {
      await apiRequest(`/api/tickets/${answeringTicket.id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer: answerText.trim() }),
      });
      setSuccessBanner('Doubt answered successfully and published to student!');
      setAnsweringTicket(null);
      setAnswerText('');
      await loadTickets();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to submit answer');
    } finally {
      setIsSubmittingAnswer(false);
    }
  }

  async function handleCloseTicket(ticketId) {
    try {
      await apiRequest(`/api/tickets/${ticketId}/close`, { method: 'POST' });
      setSuccessBanner('Ticket closed.');
      loadTickets();
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to close ticket');
    }
  }

  const countOpen = tickets.filter((t) => (!selectedBatchId || t.batch_id === selectedBatchId) && t.status === 'open').length;
  const countAnswered = tickets.filter((t) => (!selectedBatchId || t.batch_id === selectedBatchId) && t.status === 'answered').length;
  const countClosed = tickets.filter((t) => (!selectedBatchId || t.batch_id === selectedBatchId) && t.status === 'closed').length;
  const countAll = tickets.filter((t) => !selectedBatchId || t.batch_id === selectedBatchId).length;

  const filteredTickets = tickets.filter((t) => {
    if (selectedBatchId && t.batch_id !== selectedBatchId) return false;
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">Faculty Doubt Triage Desk</h1>
          <p className="text-xs text-on-surface-variant">
            Resolve student conceptual hurdles, deliver LaTeX derivations, and monitor resolution rates
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Filter Batch:
          </label>
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm font-medium text-on-surface focus:outline-none focus:border-primary"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pb-1 overflow-x-auto">
        {[
          { id: 'open', label: 'Unanswered / Open', count: countOpen },
          { id: 'answered', label: 'Answered', count: countAnswered },
          { id: 'closed', label: 'Resolved / Closed', count: countClosed },
          { id: 'all', label: 'All Tickets', count: countAll },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filterStatus === tab.id
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                filterStatus === tab.id
                  ? 'bg-on-primary/20 text-on-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tickets Feed */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-on-surface-variant">Loading student doubts...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-[44px] text-outline-variant mb-2">done_all</span>
          <h3 className="text-base font-semibold text-on-surface">No {filterStatus} doubts found</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            All student doubts for this criteria are currently settled.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      ticket.status === 'open'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                        : ticket.status === 'answered'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {ticket.status === 'open' ? 'Awaiting Answer' : ticket.status}
                  </span>
                  <span className="text-xs font-bold text-primary dark:text-blue-400">
                    Batch: {ticket.batch_name || 'Physics'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Student: {ticket.student_name || ticket.student_email || 'Student'}
                  </span>
                </div>

                <span className="text-xs text-slate-400">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Question */}
              <div className="text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <MathRenderer content={ticket.question} />
              </div>

              {/* Existing Answer */}
              {ticket.answer && (
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>Faculty Published Answer</span>
                    </span>
                    {ticket.answered_at && (
                      <span className="text-slate-400 font-normal">
                        Answered on {new Date(ticket.answered_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    <MathRenderer content={ticket.answer} />
                  </div>
                </div>
              )}

              {/* Teacher Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setAnsweringTicket(ticket);
                    setAnswerText(ticket.answer || '');
                    setModalError('');
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-container text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">reply</span>
                  <span>{ticket.answer ? 'Edit Solution' : 'Write Answer'}</span>
                </button>

                {ticket.status !== 'closed' && (
                  <button
                    onClick={() => handleCloseTicket(ticket.id)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">task_alt</span>
                    <span>Mark Resolved</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Answer Modal */}
      {answeringTicket && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Respond to Student Doubt</h3>
              <button
                onClick={() => setAnsweringTicket(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white">
              <span className="font-bold text-primary block mb-1">Student Doubt:</span>
              <MathRenderer content={answeringTicket.question} />
            </div>

            <form onSubmit={handleSubmitAnswer} className="space-y-4">
              {modalError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center justify-between">
                  <span>{modalError}</span>
                  <button type="button" onClick={() => setModalError('')} className="font-bold underline ml-2">
                    Dismiss
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Faculty Verified Solution (LaTeX Math Supported)
                </label>
                <textarea
                  rows={6}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  placeholder="Explain the concept step-by-step with formulas (e.g. $F = ma$, $v = u + at$)..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAnsweringTicket(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!answerText.trim() || isSubmittingAnswer}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmittingAnswer ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Publish Answer</span>
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
