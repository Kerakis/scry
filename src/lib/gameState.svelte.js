import { FORMATS, INITIAL_TIMER, MAX_PREVIOUSLY_CORRECT } from './constants.js';
import { buildFormatCardMap, mapCardData, selectRandomCards } from './cardUtils.js';
import { cacheCards } from './db.js';

/** @typedef {import('./cardUtils.js').Card} Card */

class GameState {
  /** @type {string | null} */
  selectedFormat = $state(null);
  /** @type {Card[]} */
  cards = $state([]);
  /** @type {Card | null} */
  correctCard = $state(null);
  level = $state(1);
  timer = $state(INITIAL_TIMER);
  gameEnded = $state(false);
  /** @type {Card | null} */
  incorrectGuess = $state(null);
  highestLevel = $state(0);
  /** @type {Array<{level: number, card: Card | null, cardImage: string | undefined, scryfall_uri: string}>} */
  history = $state([]);
  showHistory = $state(false);
  isLoading = $state(false);
  totalCards = $state(Object.fromEntries(FORMATS.map((f) => [f, 0])));

  /** @type {Record<string, any[]>} */
  #formatCardMap = {};
  /** @type {Record<string, Set<string>>} */
  #previouslyCorrect = {};
  /** @type {number | undefined} */
  #intervalId;

  async #loadData() {
    try {
      const response = await fetch('./data/cards.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.#formatCardMap = buildFormatCardMap(data.cards);
      this.totalCards = data.formatCounts;
      await cacheCards(data.cards);
      return true;
    } catch (error) {
      console.warn('Failed to load card data:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  #startNextRound() {
    if (!this.selectedFormat) return;
    const formatCards = this.#formatCardMap[this.selectedFormat] ?? [];
    const prevSet = this.#previouslyCorrect[this.selectedFormat] ?? new Set();
    const selected = selectRandomCards(formatCards, prevSet);
    this.cards = /** @type {Card[]} */ (selected.map(mapCardData).filter(Boolean));
    this.correctCard = this.cards[Math.floor(Math.random() * this.cards.length)];
    this.isLoading = false;
  }

  async preload() {
    if (Object.keys(this.#formatCardMap).length === 0) {
      await this.#loadData();
    }
  }

  /** @param {string} format */
  async selectFormat(format) {
    this.selectedFormat = format;
    this.isLoading = true;
    if (Object.keys(this.#formatCardMap).length === 0) {
      const loaded = await this.#loadData();
      if (!loaded) {
        this.isLoading = false;
        return;
      }
    }
    if ((this.#formatCardMap[format] ?? []).length < 4) {
      this.isLoading = false;
      return;
    }
    this.#startNextRound();
  }

  startTimer() {
    this.#intervalId = setInterval(() => {
      if (this.timer <= 1) {
        this.timer = 0;
        this.endGame();
      } else {
        this.timer--;
      }
    }, 1000);
  }

  /** @param {Card} card */
  guess(card) {
    if (!this.correctCard || card.id !== this.correctCard.id) {
      this.incorrectGuess = card;
      this.endGame();
      return;
    }

    if (!this.selectedFormat) return;

    if (!this.#previouslyCorrect[this.selectedFormat]) {
      this.#previouslyCorrect[this.selectedFormat] = new Set();
    }
    const seen = this.#previouslyCorrect[this.selectedFormat];
    seen.add(this.correctCard.id);
    if (seen.size > MAX_PREVIOUSLY_CORRECT) {
      const oldest = seen.values().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }

    clearInterval(this.#intervalId);
    this.history.push({
      level: this.level,
      card,
      cardImage: card.image_uris?.border_crop,
      scryfall_uri: card.scryfall_uri,
    });
    this.level++;
    this.timer = INITIAL_TIMER;
    this.#startNextRound();
  }

  endGame() {
    clearInterval(this.#intervalId);
    if (this.correctCard) {
      this.history.push({
        level: this.level,
        card: this.correctCard,
        cardImage: this.correctCard.image_uris?.border_crop,
        scryfall_uri: this.correctCard.scryfall_uri,
      });
    }

    const highScoreKey = `highScore-${this.selectedFormat}`;
    const stored = localStorage.getItem(highScoreKey);
    if (!stored || this.level > parseInt(stored, 10)) {
      localStorage.setItem(highScoreKey, this.level.toString());
    }
    this.highestLevel = parseInt(localStorage.getItem(highScoreKey) ?? '0', 10) - 1;
    this.gameEnded = true;
  }

  restartGame() {
    const format = this.selectedFormat;
    if (!format) return;
    clearInterval(this.#intervalId);
    this.correctCard = null;
    this.gameEnded = false;
    this.level = 1;
    this.timer = INITIAL_TIMER;
    this.history = [];
    this.incorrectGuess = null;
    this.selectFormat(format);
  }

  reselectFormat() {
    clearInterval(this.#intervalId);
    this.correctCard = null;
    this.gameEnded = false;
    this.level = 1;
    this.timer = INITIAL_TIMER;
    this.history = [];
    this.#previouslyCorrect = {};
    this.incorrectGuess = null;
    this.selectedFormat = null;
  }

  toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  closeHistory() {
    this.showHistory = false;
  }
}

export const gameState = new GameState();
