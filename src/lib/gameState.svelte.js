import { FORMATS, INITIAL_TIMER, MAX_PREVIOUSLY_CORRECT, ERRORS } from './constants.js';
import { buildFormatCardMap, mapCardData, selectRandomCards } from './cardUtils.js';
import { getCachedCardData, setCachedCardData } from './db.js';

/** @typedef {import('./cardUtils.js').Card} Card */

export const GAME_STATE_KEY = Symbol('gameState');

export class GameState {
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
  /** @type {string | null} */
  loadError = $state(null);
  totalCards = $state(Object.fromEntries(FORMATS.map((f) => [f, 0])));

  /** @type {Record<string, any[]>} */
  #formatCardMap = {};
  /** @type {Record<string, Set<string>>} */
  #previouslyCorrect = {};
  /** @type {number | undefined} */
  #intervalId;

  async #loadData() {
    try {
      const metaResponse = await fetch('./data/metadata.json');
      if (!metaResponse.ok) throw new Error(`HTTP ${metaResponse.status}`);
      const meta = await metaResponse.json();

      const cached = await getCachedCardData();
      if (cached?.bulkDataUpdated === meta.bulkDataUpdated) {
        this.#formatCardMap = buildFormatCardMap(cached.cards);
        this.totalCards = cached.formatCounts;
        return true;
      }

      const response = await fetch('./data/cards.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.#formatCardMap = buildFormatCardMap(data.cards);
      this.totalCards = data.formatCounts;
      await setCachedCardData({
        cards: data.cards,
        formatCounts: data.formatCounts,
        bulkDataUpdated: data.bulkDataUpdated,
      });
      return true;
    } catch (error) {
      console.warn('Failed to load card data:', error instanceof Error ? error.message : String(error));
      this.loadError = ERRORS.LOAD_FAILED;
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
    this.loadError = null;
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
      this.loadError = ERRORS.NOT_ENOUGH_CARDS;
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
    this.loadError = null;
  }

  toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  closeHistory() {
    this.showHistory = false;
  }
}

