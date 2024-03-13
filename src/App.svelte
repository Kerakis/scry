<script>
  import { shuffle } from 'lodash';
  import HistoryModal from './HistoryModal.svelte';
  import DarkModeSwitch from './DarkModeSwitch.svelte';

  let formats = [
    'Standard',
    'Pauper',
    'Pioneer',
    'Modern',
    'Legacy',
    'Vintage',
  ];
  let selectedFormat,
    cards = [],
    correctCard = null,
    level = 1,
    timer = 10,
    gameEnded = false,
    history = [],
    showHistory = false;
  let intervalId;
  let guessedCard = null;
  let isLoading = false;

  const year = new Date().getFullYear();

  async function fetchCards(format) {
    isLoading = true;
    let responses = await Promise.all(
      Array(4)
        .fill()
        .map(() => fetch(`https://api.scryfall.com/cards/random?q=f:${format}`))
    );
    cards = await Promise.all(responses.map((res) => res.json()));
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
    cards = shuffle(cards);
    correctCard = cards[Math.floor(Math.random() * cards.length)];

    isLoading = false;
  }

  function selectFormat(format) {
    selectedFormat = format;
    fetchCards(format).then(startTimer);
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
    guessedCard = card;
    if (correctCard !== null && card.id === correctCard.id) {
      clearInterval(intervalId);
      history.push({
        level,
        card,
        cardImage: card.image_uris.border_crop,
      });
      level++;
      timer = 10;
      await fetchCards(selectedFormat);
      startTimer();
    } else {
      endGame();
    }
  }

  function endGame() {
    history.push({
      level,
      card: correctCard,
      cardImage: correctCard.image_uris.border_crop,
    });
    clearInterval(intervalId);
    gameEnded = true;
  }

  function restartGame() {
    gameEnded = false;
    level = 1;
    timer = 10;
    history = [];
    fetchCards(selectedFormat);
    startTimer();
  }

  function reselectFormat() {
    gameEnded = false;
    level = 1;
    timer = 10;
    history = [];
    selectedFormat = null;
  }

  function toggleHistory() {
    showHistory = !showHistory;
  }
</script>

<div
  class="flex flex-col min-h-screen bg-light-gray dark:bg-dark-gray text-theme-color transition scroll-smooth"
>
  <div class="flex flex-col flex-1 mx-2">
    <header>
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
    <div class="flex justify-end p-4">
      <DarkModeSwitch />
    </div>
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
              class="border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap text-sm min-w-full"
              on:click={() => selectFormat(format)}>{format}</button
            >
          {/each}
        </div>
      </div>
    {:else if correctCard}
      <div class="mx-auto">
        <img
          src={correctCard.image_uris.art_crop}
          alt="Magic: The Gathering Card Art"
        />
        <div class="mx-auto max-w-lg flex flex-col mb-2 text-xs">
          {#each cards as card}
            <button
              class="overflow-hidden border rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap {card.id ===
                guessedCard?.id && gameEnded
                ? 'border-red-500'
                : card.id === correctCard.id && gameEnded
                  ? 'border-dark-gray dark:border-white'
                  : 'border-theme-color'}"
              on:click={() => guess(card)}
              disabled={gameEnded}>{card.name}</button
            >
          {/each}
        </div>
      </div>
    {/if}
    <div class="grid grid-cols-2 grid-rows-2 content-between mt-4 md:mt-8">
      <div class="justify-self-end">
        <h2 class={timer <= 3 ? 'text-red-500' : ''}>
          {timer === 0
            ? "Time's Up!"
            : `00:${timer.toString().padStart(2, '0')}`}
        </h2>
      </div>
      <div class="justify-self-start">
        <h2>Level: {level}</h2>
      </div>
      {#if gameEnded}
        <div class="justify-self-end">
          <button on:click={toggleHistory}>History</button>
          {#if showHistory}
            <HistoryModal {history} on:close={toggleHistory} />
          {/if}
        </div>
        <div class="justify-self-end">
          <button on:click={reselectFormat}>Reselect Format</button>
        </div>
        <div class="justify-self-start">
          <button on:click={restartGame}>Restart Game</button>
        </div>
      {/if}
    </div>
    {#if gameEnded}
      <div>
        <h2>Congratulations! You made it to Level {level}</h2>
      </div>
    {/if}
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
