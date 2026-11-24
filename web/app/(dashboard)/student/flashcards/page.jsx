'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/client-api';
import { MathRenderer } from '@/components/MathRenderer';

export default function StudentFlashcardsPage() {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [flashcardDecks, setFlashcardDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');
  const [knownCards, setKnownCards] = useState(new Set());

  // Load batches on mount
  useEffect(() => {
    async function loadBatches() {
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
    loadBatches();
  }, []);

  // Load flashcard decks when batch changes
  useEffect(() => {
    if (!selectedBatchId) return;
    async function loadDecks() {
      setIsLoading(true);
      setErrorBanner('');
      try {
        const data = await apiRequest(`/api/batches/${selectedBatchId}/items?type=flashcards`);
        const decks = data.items || [];
        setFlashcardDecks(decks);
        if (decks.length > 0) {
          setSelectedDeckId(decks[0].id);
          setCurrentCardIndex(0);
          setIsFlipped(false);
          setKnownCards(new Set());
        } else {
          setSelectedDeckId('');
        }
      } catch (err) {
        setErrorBanner(err.message || 'Failed to load flashcard decks');
      } finally {
        setIsLoading(false);
      }
    }
    loadDecks();
  }, [selectedBatchId]);

  const activeDeck = flashcardDecks.find((d) => d.id === selectedDeckId);
  const cards = Array.isArray(activeDeck?.content?.cards)
    ? activeDeck.content.cards
    : Array.isArray(activeDeck?.content)
    ? activeDeck.content
    : [];

  const currentCard = cards[currentCardIndex];
  const totalCards = cards.length;

  function handleNext() {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % totalCards);
  }

  function handlePrev() {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + totalCards) % totalCards);
  }

  function handleMarkMastered() {
    setKnownCards((prev) => new Set(prev).add(currentCardIndex));
    handleNext();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[24px]">style</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight">Formula Flashcards</h1>
            <p className="text-xs text-on-surface-variant">
              Active recall deck with spaced repetition for key definitions and physical laws
            </p>
          </div>
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

      {/* Deck Selector if multiple */}
      {flashcardDecks.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {flashcardDecks.map((deck) => (
            <button
              key={deck.id}
              onClick={() => {
                setSelectedDeckId(deck.id);
                setCurrentCardIndex(0);
                setIsFlipped(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDeckId === deck.id
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {deck.title}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="p-16 text-center text-xs text-on-surface-variant">Loading flashcards...</div>
      ) : totalCards === 0 ? (
        <div className="p-16 text-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2">style</span>
          <h3 className="text-base font-semibold text-on-surface">No Flashcard Decks Available</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Faculty hasn&apos;t generated flashcards for this batch yet.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>
              Card {currentCardIndex + 1} of {totalCards}
            </span>
            <span className="text-tertiary font-semibold">
              Mastered: {knownCards.size} / {totalCards}
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${((currentCardIndex + 1) / totalCards) * 100}%` }}
            />
          </div>

          {/* Interactive Flashcard with Flip */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full min-h-[320px] p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-md hover:shadow-lg cursor-pointer transition-all flex flex-col justify-between select-none relative group"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-xs font-bold uppercase tracking-wider text-primary">
                {isFlipped ? 'Answer / Derivation' : 'Concept / Question'}
              </span>
              <span className="text-xs text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px] group-hover:rotate-180 transition-transform">
                  sync
                </span>
                Click card to flip
              </span>
            </div>

            {/* Card Body */}
            <div className="my-8 text-center flex flex-col items-center justify-center">
              <div className="text-lg md:text-xl font-semibold text-on-surface leading-relaxed max-w-xl">
                {isFlipped ? (
                  <MathRenderer content={currentCard?.back || currentCard?.definition || currentCard?.answer || 'No answer'} />
                ) : (
                  <MathRenderer content={currentCard?.front || currentCard?.term || currentCard?.question || 'No question'} />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-on-surface-variant pt-4 border-t border-outline-variant/20">
              <span>{activeDeck?.title}</span>
              <span className="italic">{isFlipped ? 'Click again to view question' : 'Click to reveal formula'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Previous</span>
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Skip</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleNext}
                className="px-4 py-2.5 rounded-xl bg-error-container text-on-error-container text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Need Practice</span>
              </button>
              <button
                onClick={handleMarkMastered}
                className="px-5 py-2.5 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">verified</span>
                <span>I Know This!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
