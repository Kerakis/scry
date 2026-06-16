<script>
  import { onMount, tick } from 'svelte';
  import { gameState } from './lib/gameState.svelte.js';
  import FormatSelector from './lib/FormatSelector.svelte';
  import GameBoard from './lib/GameBoard.svelte';
  import HistoryModal from './lib/HistoryModal.svelte';
  import DarkModeSwitch from './lib/DarkModeSwitch.svelte';

  let game = $state();
  let gameOver = $state();
  const year = new Date().getFullYear();

  onMount(async () => {
    await gameState.preload();
  });

  $effect(() => {
    if (gameState.gameEnded) {
      gameOver?.scrollIntoView({ behavior: 'smooth' });
    }
  });

  /** @param {string} format */
  async function handleSelectFormat(format) {
    await gameState.selectFormat(format);
    await tick();
    game?.scrollIntoView({ behavior: 'smooth' });
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
    {#if gameState.isLoading}
      <div class="flex justify-center items-center">
        <div
          class="w-16 h-16 border-t-4 border-blue-500 rounded-full animate-spin"
        ></div>
      </div>
    {:else if !gameState.selectedFormat}
      <FormatSelector onselect={handleSelectFormat} />
    {:else if gameState.correctCard}
      <GameBoard />
    {/if}
    <div class="w-full max-w-lg mx-auto">
      {#if gameState.selectedFormat}
        <div
          bind:this={game}
          class="grid grid-cols-2 content-between mt-4 md:mt-8 mx-auto"
        >
          <button
            class="w-3/4 border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-start {!gameState.gameEnded
              ? ''
              : 'hover:border-dark-gray dark:hover:border-white duration-100'}"
            disabled={!gameState.gameEnded}
            onclick={() => gameState.toggleHistory()}
          >
            <span class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0">
              {!gameState.gameEnded ? `Level: ${gameState.level}` : `History`}
            </span>
          </button>
          {#if gameState.showHistory}
            <HistoryModal
              history={gameState.history}
              onclose={() => gameState.closeHistory()}
            />
          {/if}
          <button
            class="w-3/4 border border-theme-color rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-end {gameState.timer <
            4
              ? 'text-red-500'
              : ''}"
            disabled
          >
            <span class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0">
              {gameState.timer === 0
                ? `Time's Up!`
                : `00:${gameState.timer.toString().padStart(2, '0')}`}
            </span>
          </button>
        </div>
      {/if}
      {#if gameState.gameEnded}
        <div bind:this={gameOver} class="grid grid-cols-2 content-between">
          <button
            class="w-3/4 border border-theme-color rounded-sm h-8 mt-4 uppercase font-extrabold whitespace-nowrap justify-self-start hover:border-dark-gray dark:hover:border-white duration-100"
            onclick={() => gameState.restartGame()}
          >
            <span class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0">
              Restart Game
            </span>
          </button>
          <button
            class="w-3/4 justify-self-end border border-theme-color rounded-sm h-8 mt-4 uppercase font-extrabold whitespace-nowrap hover:border-dark-gray dark:hover:border-white duration-100"
            onclick={() => gameState.reselectFormat()}
          >
            <span class="xs:text-xxs text-xs md:text-sm overflow-hidden duration-0">
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
