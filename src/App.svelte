<script>
  import { shuffle } from 'lodash';
  import HistoryModal from './HistoryModal.svelte';
  import DarkModeSwitch from './DarkModeSwitch.svelte';

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

  function preloadCards(format) {
    const preloadedCards = [];
    while (preloadedCards.length < 4) {
      const randomIndex = Math.floor(Math.random() * cache[format].length);
      const card = cache[format].splice(randomIndex, 1)[0];
      preloadedCards.push(card);
    }
    return preloadedCards;
  }

  function mapCardData(cards) {
    return cards.map((card) => {
      if (card.layout === 'split') {
        return card;
      } else if (card.card_faces !== undefined) {
        return {
          ...card,
          image_uris: card.image_uris
            ? card.image_uris
            : card.card_faces[0].image_uris,
          name: card.card_faces[0].name,
        };
      } else {
        return card;
      }
    });
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
      const randomResponse = await fetch(
        `https://api.scryfall.com/cards/search?q=f:${format}&order=usd&page=${randomPage}`
      );
      const randomData = await randomResponse.json();
      totalCards[format] = randomData.total_cards; // Update total_cards
      cache[format] = shuffle(randomData.data); // Shuffle the cards
      preloadedCards = preloadCards(format);
      preloadedCards = mapCardData(preloadedCards);
      startNextRound(false);
      game.scrollIntoView({ behavior: 'smooth' });
      startTimer();
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
    const data = await response.json();
    cache[format] = cache[format].concat(shuffle(data.data)); // Shuffle the cards
    isLoadingNextCards = false;
  }

  function startNextRound(shouldTimerStart = true) {
    console.log(cache[selectedFormat].length);
    if (cache[selectedFormat].length < 20) {
      fetchNextBatch(selectedFormat);
    }
    // Move preloaded cards to current cards
    cards = preloadedCards;

    cards = cards.map((card) => {
      if (card.layout === 'split') {
        return card;
      } else if (card.card_faces !== undefined) {
        return {
          ...card,
          image_uris: card.image_uris
            ? card.image_uris
            : card.card_faces[0].image_uris,
          name: card.card_faces[0].name,
        };
      } else {
        return card;
      }
    });

    preloadedCards = preloadCards(selectedFormat);
    preloadedCards = mapCardData(preloadedCards);

    do {
      if (cards.length === 0) {
        console.error('No cards available');
        return;
      }
      correctCard = cards[Math.floor(Math.random() * cards.length)];
    } while (previouslyCorrectCards[selectedFormat]?.includes(correctCard.id));

    isLoading = false;
    if (shouldTimerStart) {
      startTimer();
    }
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
      });
      level++;
      timer = 10;
      // Wait until fetchNextCards has finished before starting the next round
      while (isLoadingNextCards) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      startNextRound();
    } else {
      incorrectGuess = card;
      endGame();
    }
  }

  function endGame() {
    if (gameOver) {
      gameOver.scrollIntoView({ behavior: 'smooth' });
    }
    history.push({
      level,
      card: correctCard,
      cardImage: correctCard.image_uris.border_crop,
    });
    clearInterval(intervalId);
    gameEnded = true;
  }

  function restartGame() {
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
  class="flex flex-col min-h-screen bg-light-gray dark:bg-dark-gray text-theme-color transition scroll-smooth"
>
  <div class="flex flex-col flex-1 mx-2">
    <header>
      <div class="flex justify-end p-4">
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
            alt="Magic: The Gathering Card Art"
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
