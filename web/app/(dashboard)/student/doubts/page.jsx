'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';
import { MathRenderer } from '@/components/MathRenderer';

export default function StudentDoubtsPage() {
  const [batches, setBatches] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all'); // all | open | answered | closed
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const [successBanner, setSuccessBanner] = useState('');

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const [batchRes, ticketRes] = await Promise.all([
          apiRequest('/api/batches'),
          apiRequest('/api/tickets'),
        ]);
        if (batchRes.batches && batchRes.batches.length > 0) {
          setBatches(batchRes.batches);
          setSelectedBatchId(batchRes.batches[0].id);
        }
        setTickets(ticketRes.tickets || []);
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load tickets');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleCreateTicket(e) {
    e.preventDefault();
    if (!newQuestion.trim() || !selectedBatchId || isSubmitting) return;

    setIsSubmitting(true);
    setErrorBanner('');
    try {
      const res = await apiRequest(`/api/batches/${selectedBatchId}/tickets`, {
        method: 'POST',
        body: JSON.stringify({ question: newQuestion.trim() }),
      });
      if (res.ticket) {
        setTickets((prev) => [res.ticket, ...prev]);
        setNewQuestion('');
        setIsModalOpen(false);
        setSuccessBanner('Doubt ticket submitted! Your faculty will provide a verified response.');
        setTimeout(() => setSuccessBanner(''), 5000);
      }
    } catch (err) {
      setErrorBanner(err.message || 'Failed to create doubt ticket');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCloseTicket(ticketId) {
    try {
      await apiRequest(`/api/tickets/${ticketId}/close`, { method: 'POST' });
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: 'closed' } : t))
      );
      setSuccessBanner('Ticket resolved and closed.');
      setTimeout(() => setSuccessBanner(''), 4000);
    } catch (err) {
      setErrorBanner(err.message || 'Failed to close ticket');
    }
  }

  const openCount = tickets.filter((t) => t.status === 'open').length;
  const answeredCount = tickets.filter((t) => t.status === 'answered').length;
  const closedCount = tickets.filter((t) => t.status === 'closed').length;

  const filteredTickets = tickets.filter((t) => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">help_center</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Student Doubt Desk</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submit complex questions for direct 1-on-1 faculty answers
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-container text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Ask New Doubt</span>
        </button>
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
        <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successBanner}</span>
        </div>
      )}

      {/* Top Metric Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">In-Flight Doubts</span>
            <div className="text-2xl font-extrabold text-slate-900 dark:text-white">{openCount}</div>
            <p className="text-[11px] text-slate-500">Awaiting faculty response</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">pending_actions</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Answered by Faculty</span>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{answeredCount}</div>
            <p className="text-[11px] text-slate-500">Verified step-by-step solutions</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">verified</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resolved Doubts</span>
            <div className="text-2xl font-extrabold text-slate-700 dark:text-slate-300">{closedCount}</div>
            <p className="text-[11px] text-slate-500">Completed &amp; archived</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">task_alt</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Response SLA</span>
            <div className="text-2xl font-extrabold text-primary dark:text-blue-400">&lt; 2.0 hrs</div>
            <p className="text-[11px] text-slate-500">Kota Academic SLA target</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">timer</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {[
          { id: 'all', label: `All Doubts (${tickets.length})` },
          { id: 'open', label: `Awaiting Answer (${openCount})` },
          { id: 'answered', label: `Answered (${answeredCount})` },
          { id: 'closed', label: `Resolved (${closedCount})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterStatus === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-on-surface-variant">Loading your doubts...</div>
      ) : filteredTickets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">check_circle</span>
          <h3 className="text-base font-semibold text-on-surface">No {filterStatus} doubts found</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Need help with a derivation or problem? Click &ldquo;Ask New Doubt&rdquo; above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const isAnswered = ticket.status === 'answered';
            const isClosed = ticket.status === 'closed';

            return (
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
                      {ticket.status === 'open' ? 'Awaiting Faculty' : ticket.status}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Batch: {ticket.batch_name || 'Physics'}
                    </span>
                  </div>

                  <span className="text-xs text-slate-400">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Question */}
                <div className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  <MathRenderer content={ticket.question} />
                </div>

                {/* Answer Box if answered */}
                {ticket.answer && (
                  <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Faculty Verified Solution</span>
                      </span>
                      {ticket.answered_at && (
                        <span className="text-slate-400 font-normal">
                          {new Date(ticket.answered_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                      <MathRenderer content={ticket.answer} />
                    </div>
                  </div>
                )}

                {/* Close action if not closed */}
                {!isClosed && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleCloseTicket(ticket.id)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:text-primary hover:border-primary flex items-center gap-1.5 font-semibold transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px] text-emerald-600">task_alt</span>
                      <span>Mark as Resolved</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating ticket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative z-10">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Ask Faculty a Question</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Select Batch
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  Your Question / Doubt Details
                </label>
                <textarea
                  rows={4}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Describe what part of the formula, concept, or problem you are struggling with..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newQuestion.trim() || isSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-white hover:bg-primary-container disabled:opacity-50 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Submit Doubt</span>
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
