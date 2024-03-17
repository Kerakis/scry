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

  // Game formats and their total card counts
  let formats = [
    'Standard',
    'Pauper',
    'Pioneer',
    'Modern',
    'Legacy',
    'Vintage',
  ];
  let totalCards = {
    Standard: 3037,
    Pauper: 9502,
    Pioneer: 11101,
    Modern: 18402,
    Legacy: 26619,
    Vintage: 26679,
  };

  // Game state variables
  let selectedFormat;
  let cards = [];
  let correctCard;
  let level = 1;
  let timer = 10;
  let gameEnded = false;
  let incorrectGuess = null;

  // Game history variables
  let history = [];
  let showHistory = false;

  // Game elements for scrolling
  let game;
  let gameOver;
  let gameMounted;

  onMount(() => {
    gameMounted = Promise.resolve();
  });

  // Card caching variables
  let cache = {};
  let fetchedPages = {};
  let totalPages = {};
  let previouslyCorrectCards = {};
  let preloadedCards = [];

  // Loading state variables
  let isLoading = false;
  let isLoadingNextCards = false;

  // Timer variable
  let intervalId;

  // Current year
  const year = new Date().getFullYear();

  async function preloadCards(format) {
    const transaction = db.transaction(['cards', 'formats'], 'readwrite');
    const cardStore = transaction.objectStore('cards');
    const formatStore = transaction.objectStore('formats');
    const formatCards = (await formatStore.get(format)) || [];
    const preloadedCards = [];
    while (preloadedCards.length < 4) {
      if (formatCards.length === 0) {
        console.error('No more cards to preload');
        break;
      }
      const randomIndex = Math.floor(Math.random() * formatCards.length);
      const cardId = formatCards.splice(randomIndex, 1)[0];
      const card = await cardStore.get(cardId);
      preloadedCards.push(card);
    }
    // Save the updated format cards back to IndexedDB
    await formatStore.put(formatCards, format);
    return preloadedCards;
  }

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
      };
    } else {
      return {
        id: card.id,
        image_uris: card.image_uris
          ? card.image_uris
          : card.card_faces[0].image_uris,
        name: card.card_faces[0].name,
      };
    }
  }

  async function fetchCards(format) {
    isLoading = true;
    try {
      totalPages[format] = Math.ceil(totalCards[format] / 175); // Calculate total pages
      fetchedPages[format] = new Set();
      let randomPage;
      do {
        randomPage = Math.floor(Math.random() * totalPages[format]) + 1; // Choose a random page within valid range
      } while (fetchedPages[format].has(randomPage)); // Ensure the page hasn't been fetched before
      fetchedPages[format].add(randomPage);
      const response = await fetch(
        `https://api.scryfall.com/cards/search?q=f:${format}&order=usd&page=${randomPage}`
      );
      const randomData = await response.json();
      const transaction = db.transaction(['cards', 'formats'], 'readwrite');
      const cardStore = transaction.objectStore('cards');
      const formatStore = transaction.objectStore('formats');
      const existingCards = (await cardStore.getAllKeys()) || [];
      const newCards = shuffle(randomData.data); // Shuffle the cards
      const formatCards = (await formatStore.get(format)) || [];
      for (const card of newCards) {
        if (!existingCards.includes(card.id)) {
          await cardStore.put(card, card.id);
        }
        if (!formatCards.includes(card.id)) {
          formatCards.push(card.id);
        }
      }
      await formatStore.put(formatCards, format);
      preloadedCards = await preloadCards(format);
      if (preloadedCards.length < 4) {
        await fetchNextBatch(format);
        preloadedCards = await preloadCards(format);
      }
      cards = preloadedCards.map(mapCardData);
      startNextRound();
      gameMounted.then(() => {
        game.scrollIntoView({ behavior: 'smooth' });
      });
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      isLoading = false;
    }
  }

  async function fetchNextBatch(format) {
    isLoadingNextCards = true;
    let randomPage;
    do {
      randomPage = Math.floor(Math.random() * totalPages[format]) + 1; // Choose a random page within valid range
    } while (fetchedPages[format].has(randomPage)); // Ensure the page hasn't been fetched before
    fetchedPages[format].add(randomPage);
    const response = await fetch(
      `https://api.scryfall.com/cards/search?q=f:${format}&order=usd&page=${randomPage}`
    );
    const randomData = await response.json();
    const cardStore = db.transaction('cards', 'readwrite').objectStore('cards');
    const formatStore = db
      .transaction('formats', 'readwrite')
      .objectStore('formats');
    const existingCards = (await cardStore.getAllKeys()) || [];
    const newCards = shuffle(randomData.data); // Shuffle the cards
    const formatCards = (await formatStore.get(format)) || [];
    for (const card of newCards) {
      if (!existingCards.includes(card.id)) {
        await cardStore.put(card, card.id);
      }
      if (!formatCards.includes(card.id)) {
        formatCards.push(card.id);
      }
    }
    await formatStore.put(formatCards, format);
    isLoadingNextCards = false;
  }

  async function startNextRound() {
    const transaction = db.transaction(['cards', 'formats'], 'readwrite');
    const cardStore = transaction.objectStore('cards');
    const formatStore = transaction.objectStore('formats');
    const formatCards = (await formatStore.get(selectedFormat)) || [];
    if (formatCards.length < 4) {
      await fetchNextBatch(selectedFormat);
      preloadedCards = await preloadCards(selectedFormat);
      cards = preloadedCards.map(mapCardData);
    }
    let guessOptions = [...cards]; // Create a copy of the cards array
    do {
      if (guessOptions.length === 0) {
        console.error('No cards available');
        return;
      }
      const randomIndex = Math.floor(Math.random() * guessOptions.length);
      const cardId = guessOptions.splice(randomIndex, 1)[0].id;
      const card = await cardStore.get(cardId);
      correctCard = mapCardData(card);
    } while (!correctCard);
    isLoading = false;
  }

  function selectFormat(format) {
    selectedFormat = format;
    preloadedCards = [];
    fetchCards(format);
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
      if (!previouslyCorrectCards[selectedFormat]) {
        previouslyCorrectCards[selectedFormat] = [];
      }
      previouslyCorrectCards[selectedFormat].push(correctCard.id);
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
      // Wait until fetchNextBatch has finished before starting the next round
      while (isLoadingNextCards) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      preloadedCards = await preloadCards(selectedFormat);
      cards = preloadedCards.map(mapCardData);
      startNextRound();
    } else {
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
    });
    clearInterval(intervalId);
    gameEnded = true;
  }

  function restartGame() {
    correctCard = null; // Prevent the previous artwork from showing
    clearInterval(intervalId);
    gameEnded = false;
    level = 1;
    timer = 10;
    history = [];
    previouslyCorrectCards = {};
    incorrectGuess = null;
    fetchCards(selectedFormat);
  }

  function reselectFormat() {
    correctCard = null; // Prevent the previous artwork from showing
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

  $: {
    if (showHistory) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }
</script>

<div
  class="flex flex-col min-h-screen bg-light-gray dark:bg-dark-gray font-montserrat text-theme-color transition scroll-smooth"
>
  <div class="flex flex-col flex-1 mx-2">
    <header>
      <div class="absolute right-8 top-2">
        <DarkModeSwitch />
      </div>
      <div class="m-8">
        <h1 class="md:text-5xl text-3xl text-center font-extrabold">
          Parallels
        </h1>
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
    {#if isLoading || isLoadingNextCards}
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
              class="border border-theme-color hover:border-dark-gray dark:hover:border-white duration-100 rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap text-sm min-w-full"
              on:click={() => selectFormat(format)}>{format}</button
            >
          {/each}
        </div>
      </div>
    {:else if correctCard}
      <div class="flex flex-col items-center">
        <div>
          <img
            src={correctCard.image_uris.art_crop}
            alt={correctCard.name}
            on:load={startTimer}
          />
        </div>
        {#if gameEnded}
          <div class="text-center mt-2">
            <h2>Congratulations! You made it to Level {level}</h2>
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
              on:click={() => guess(card)}
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
            on:click={toggleHistory}
          >
            <span
              class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0"
            >
              {!gameEnded ? `Level: ${level}` : `History`}
            </span>
          </button>
          {#if showHistory}
            <HistoryModal {history} on:close={toggleHistory} />
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
            class="w-3/4 border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-start hover:border-dark-gray dark:hover:border-white duration-100"
            on:click={restartGame}
          >
            <span
              class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0"
            >
              Restart Game
            </span>
          </button>
          <button
            class="w-3/4 justify-self-end border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap hover:border-dark-gray dark:hover:border-white duration-100"
            on:click={reselectFormat}
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
      class="flex-shrink-0 mt-8 text-sm text-dark-gray dark:text-light-gray text-center lg:fixed lg:m-1 lg:bottom-0 lg:right-1"
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
