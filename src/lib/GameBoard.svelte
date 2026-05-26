<script>
  import { onMount, onDestroy } from 'svelte';
  import { gameState } from './gameState.svelte.js';

  function cardButtonClass(card) {
    if (!gameState.gameEnded) {
      return 'border-theme-color hover:border-dark-gray dark:hover:border-white duration-100';
    }
    if (card.id === gameState.incorrectGuess?.id) return 'border-red-500';
    if (card.id === gameState.correctCard?.id) return 'border-dark-gray dark:border-white';
    return 'border-theme-color';
  }

  function handleKeydown(event) {
    if (gameState.gameEnded) return;
    const index = parseInt(event.key) - 1;
    if (index >= 0 && index < gameState.cards.length) {
      gameState.guess(gameState.cards[index]);
    }
  }

  onMount(() => window.addEventListener('keydown', handleKeydown));
  onDestroy(() => window.removeEventListener('keydown', handleKeydown));
</script>

<div class="flex flex-col items-center">
  <div>
    <img
      src={gameState.correctCard.image_uris.art_crop}
      alt={gameState.correctCard.name}
      onload={() => gameState.startTimer()}
    />
  </div>
  {#if gameState.gameEnded}
    <div class="text-center mt-2">
      {#if gameState.highestLevel > 0}
        <h2>
          Congratulations! You made it to Level {gameState.level}. Your highest
          completed level for {gameState.selectedFormat} is {gameState.highestLevel}.
        </h2>
      {:else}
        <h2>Congratulations! You made it to Level {gameState.level}.</h2>
      {/if}
    </div>
  {/if}
  <div class="flex flex-col items-center w-full">
    {#each gameState.cards as card, i}
      <button
        class="w-full max-w-lg text-xs overflow-hidden border rounded h-8 mt-4 uppercase font-extrabold whitespace-nowrap {cardButtonClass(card)}"
        onclick={() => gameState.guess(card)}
        disabled={gameState.gameEnded}
      >
        <span class="opacity-40 mr-2">[{i + 1}]</span>{card.name}
      </button>
    {/each}
  </div>
</div>
