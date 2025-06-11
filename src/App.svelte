<script>
  import { onMount } from 'svelte';
  import { shuffle } from 'lodash';
  import { openDB } from 'idb';
  import HistoryModal from './HistoryModal.svelte';
  import DarkModeSwitch from './DarkModeSwitch.svelte';

  // Initialize IndexedDB
  let db;
  async function initDB() {
    db = await openDB('mtg-cache', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('formats')) {
          db.createObjectStore('formats');
        }
        if (!db.objectStoreNames.contains('cards')) {
          db.createObjectStore('cards');
        }
      },
    });
  }
  initDB();

  // Game formats
  let formats = [
    'Standard',
    'Pauper',
    'Pioneer',
    'Modern',
    'Legacy',
    'Vintage',
  ];

  // Will be loaded from static data - make reactive
  let totalCards = $state({
    Standard: 0,
    Pauper: 0,
    Pioneer: 0,
    Modern: 0,
    Legacy: 0,
    Vintage: 0,
  });

  // Game state variables
  let selectedFormat = $state();
  let cards = $state([]);
  let correctCard = $state();
  let level = $state(1);
  let timer = $state(10);
  let gameEnded = $state(false);
  let incorrectGuess = $state(null);
  let highestLevel = $state();

  // Game history variables
  let history = $state([]);
  let showHistory = $state(false);

  // Game elements for scrolling
  let game = $state();
  let gameOver = $state();
  let gameMounted;

  // Card caching variables
  let previouslyCorrectCards = {};
  let allFormatCards = [];

  // Loading state variables
  let isLoading = $state(false);

  // Timer variable
  let intervalId;

  // Current year
  const year = new Date().getFullYear();

  // Load static card data and update total cards
  async function loadStaticCardData() {
    try {
      console.log('📥 Loading static card data...');
      const response = await fetch('./data/cards.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      allFormatCards = data.cards;
      totalCards = data.formatCounts; // This now works with reactive state

      console.log(`✅ Loaded ${allFormatCards.length} total cards`);
      console.log('📊 Format counts:', totalCards);

      // Cache all cards in IndexedDB for offline use
      const transaction = db.transaction(['cards'], 'readwrite');
      const cardStore = transaction.objectStore('cards');

      for (const card of allFormatCards) {
        await cardStore.put(card, card.id);
      }

      console.log('💾 Cards cached in IndexedDB');
      return true;
    } catch (error) {
      console.warn('⚠️ Failed to load static card data:', error.message);
      return false;
    }
  }

  // Get cards for a specific format
  function getFormatCards(format) {
    return allFormatCards.filter((card) => card.formats.includes(format));
  }

  // Map card data to the format expected by the game
  function mapCardData(card) {
    if (!card) {
      console.error('Card is undefined');
      return;
    }

    if (card.layout === 'split' || !card.card_faces) {
      return {
        id: card.id,
        image_uris: card.image_uris,
        name: card.name,
        scryfall_uri: card.scryfall_uri,
      };
    } else {
      return {
        id: card.id,
        image_uris: card.image_uris
          ? card.image_uris
          : card.card_faces[0].image_uris,
        name: card.card_faces[0].name,
        scryfall_uri: card.scryfall_uri,
      };
    }
  }

  // Select 4 random cards for the current round
  function selectRandomCards(format) {
    const formatCards = getFormatCards(format);

    // Filter out previously correct cards to avoid repeats
    const availableCards = formatCards.filter((card) => {
      if (!previouslyCorrectCards[format]) return true;
      return !previouslyCorrectCards[format].includes(card.id);
    });

    // If we've used too many cards, reset the exclusion list
    if (availableCards.length < 4) {
      console.log('🔄 Resetting previously correct cards for variety');
      previouslyCorrectCards[format] = [];
      return shuffle(formatCards).slice(0, 4);
    }

    return shuffle(availableCards).slice(0, 4);
  }

  // Start a new round with fresh cards
  function startNextRound() {
    const selectedCards = selectRandomCards(selectedFormat);
    cards = selectedCards.map(mapCardData);

    // Select one card as the correct answer
    const randomIndex = Math.floor(Math.random() * cards.length);
    correctCard = cards[randomIndex];

    isLoading = false;
  }

  // Select format and start the game
  async function selectFormat(format) {
    selectedFormat = format;
    isLoading = true;

    // Ensure static data is loaded
    if (allFormatCards.length === 0) {
      const dataLoaded = await loadStaticCardData();
      if (!dataLoaded) {
        console.error('❌ Could not load card data');
        isLoading = false;
        return;
      }
    }

    const formatCards = getFormatCards(format);
    console.log(
      `🎮 Starting ${format} with ${formatCards.length} available cards`
    );

    if (formatCards.length < 4) {
      console.error(`❌ Not enough cards for ${format}: ${formatCards.length}`);
      isLoading = false;
      return;
    }

    startNextRound();

    setTimeout(() => {
      game?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function startTimer() {
    intervalId = setInterval(() => {
      if (timer === 1) {
        timer--;
        endGame();
      } else {
        timer--;
      }
    }, 1000);
  }

  async function guess(card) {
    if (correctCard !== null && card.id === correctCard.id) {
      // Correct guess
      if (!previouslyCorrectCards[selectedFormat]) {
        previouslyCorrectCards[selectedFormat] = [];
      }
      previouslyCorrectCards[selectedFormat].push(correctCard.id);

      // Keep only the last 100 correct cards to maintain variety
      if (previouslyCorrectCards[selectedFormat].length > 100) {
        previouslyCorrectCards[selectedFormat].shift();
      }

      clearInterval(intervalId);
      history.push({
        level,
        card,
        cardImage: card.image_uris.border_crop,
        scryfall_uri: card.scryfall_uri,
      });

      level++;
      timer = 10;
      startNextRound();
    } else {
      // Incorrect guess
      incorrectGuess = card;
      endGame();
    }
  }

  function endGame() {
    gameEnded = true;
    gameMounted.then(() => {
      gameOver.scrollIntoView({ behavior: 'smooth' });
    });
    history.push({
      level,
      card: correctCard,
      cardImage: correctCard.image_uris.border_crop,
      scryfall_uri: correctCard.scryfall_uri,
    });
    clearInterval(intervalId);

    // Check if the current level is higher than the stored high score
    const highScoreKey = `highScore-${selectedFormat}`;
    const storedHighScore = localStorage.getItem(highScoreKey);
    if (!storedHighScore || level > parseInt(storedHighScore, 10)) {
      localStorage.setItem(highScoreKey, level.toString());
    }
  }

  function restartGame() {
    correctCard = null;
    clearInterval(intervalId);
    gameEnded = false;
    level = 1;
    timer = 10;
    history = [];
    incorrectGuess = null;
    // Don't reset previouslyCorrectCards to maintain variety
    selectFormat(selectedFormat);
  }

  function reselectFormat() {
    correctCard = null;
    clearInterval(intervalId);
    gameEnded = false;
    level = 1;
    timer = 10;
    history = [];
    previouslyCorrectCards = {};
    incorrectGuess = null;
    selectedFormat = null;
  }

  function toggleHistory() {
    showHistory = !showHistory;
  }

  function closeHistory() {
    showHistory = false;
  }

  // Initialize the app
  onMount(async () => {
    gameMounted = Promise.resolve();
    await loadStaticCardData();
  });

  // When the game ends, update highestLevel
  $effect(() => {
    if (gameEnded) {
      const highScoreKey = `highScore-${selectedFormat}`;
      const storedHighScore = localStorage.getItem(highScoreKey);
      highestLevel = storedHighScore ? parseInt(storedHighScore, 10) - 1 : 0;
    }
  });

  $effect(() => {
    if (showHistory) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  });
</script>

<!-- Keep the existing markup - it doesn't need to change -->
<div
  class="flex flex-col min-h-screen bg-light-gray dark:bg-dark-gray font-montserrat text-theme-color transition scroll-smooth"
>
  <div class="flex flex-col flex-1 mx-2">
    <header>
      <div class="absolute right-8 top-2">
        <DarkModeSwitch />
      </div>
      <div class="m-8">
        <h1 class="md:text-5xl text-3xl text-center font-extrabold">Scry</h1>
        <h2
          class="md:text-2xl text-xl text-dark-gray dark:text-white text-center md:mt-3 mt-2 mb-4"
        >
          The Magic: The Gathering Art Matching Game
        </h2>
      </div>
      <h3
        class="md:text-xl text-l text-dark-gray dark:text-white text-center md:mt-3 mt-2 mb-4"
      >
        Guess the card based on the art!
      </h3>
    </header>
    {#if isLoading}
      <div class="flex justify-center items-center">
        <div
          class="w-16 h-16 border-t-4 border-blue-500 rounded-full animate-spin"
        ></div>
      </div>
    {:else if !selectedFormat}
      <div class="mt-20 text-center font-bold">
        <p class="mb-4">What format would you like cards from?</p>
        <div class="max-w-xs mx-auto">
          {#each formats as format}
            <button
              class="border border-theme-color hover:border-dark-gray dark:hover:border-white duration-100 rounded-sm h-8 mt-4 uppercase font-extrabold whitespace-nowrap text-sm min-w-full"
              onclick={() => selectFormat(format)}
            >
              {format}
            </button>
          {/each}
        </div>
      </div>
    {:else if correctCard}
      <div class="flex flex-col items-center">
        <div>
          <img
            src={correctCard.image_uris.art_crop}
            alt={correctCard.name}
            onload={startTimer}
          />
        </div>
        {#if gameEnded}
          <div class="text-center mt-2">
            {#if highestLevel > 0}
              <h2>
                Congratulations! You made it to Level {level}. Your highest
                completed level for {selectedFormat} is {highestLevel}.
              </h2>
            {:else}
              <h2>Congratulations! You made it to Level {level}.</h2>
            {/if}
          </div>
        {/if}
        <div class="flex flex-col items-center w-full">
          {#each cards as card}
            <button
              class="w-full max-w-lg text-xs overflow-hidden border rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap {card.id ===
                incorrectGuess?.id && gameEnded
                ? 'border-red-500'
                : card.id === correctCard.id && gameEnded
                  ? 'border-dark-gray dark:border-white'
                  : gameEnded
                    ? 'border-theme-color'
                    : 'border-theme-color hover:border-dark-gray dark:hover:border-white duration-100'}"
              onclick={() => guess(card)}
              disabled={gameEnded}>{card.name}</button
            >
          {/each}
        </div>
      </div>
    {/if}
    <div class="w-full max-w-lg mx-auto">
      {#if selectedFormat}
        <div
          bind:this={game}
          class="grid grid-cols-2 content-between mt-4 md:mt-8 mx-auto"
        >
          <button
            class="w-3/4 border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-start {!gameEnded
              ? ''
              : 'hover:border-dark-gray dark:hover:border-white duration-100'}"
            disabled={!gameEnded}
            onclick={toggleHistory}
          >
            <span
              class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0"
            >
              {!gameEnded ? `Level: ${level}` : `History`}
            </span>
          </button>
          {#if showHistory}
            <HistoryModal {history} onclose={closeHistory} />
          {/if}
          <button
            class="w-3/4 border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-end {!gameEnded
              ? ''
              : 'hover:border-dark-gray dark:hover:border-white duration-100'} {timer <
            4
              ? 'text-red-500'
              : ''}"
            disabled
          >
            <span
              class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0"
            >
              {timer === 0
                ? `Time's Up!`
                : `00:${timer.toString().padStart(2, '0')}`}
            </span>
          </button>
        </div>
      {/if}
      {#if gameEnded}
        <div bind:this={gameOver} class="grid grid-cols-2 content-between">
          <button
            class="w-3/4 border border-theme-color rounded-sm h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-start hover:border-dark-gray dark:hover:border-white duration-100"
            onclick={restartGame}
          >
            <span
              class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0"
            >
              Restart Game
            </span>
          </button>
          <button
            class="w-3/4 justify-self-end border border-theme-color rounded-sm h-8 mt-4 uppercase font-extrabold whitespace-nowrap hover:border-dark-gray dark:hover:border-white duration-100"
            onclick={reselectFormat}
          >
            <span
              class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0"
            >
              Change Format
            </span>
          </button>
        </div>
      {/if}
    </div>
    <footer
      class="shrink-0 mt-8 text-sm text-dark-gray dark:text-light-gray text-center lg:fixed lg:m-1 lg:bottom-0 lg:right-1"
    >
      <p>
        Made with <span class="font-sans">&#9749;</span> by
        <a
          href="https://github.com/Kerakis"
          target="_blank"
          rel="noopener noreferrer"
        >
          &nbsp;Kerakis&nbsp;© {year}
        </a>
      </p>
    </footer>
  </div>
</div>
