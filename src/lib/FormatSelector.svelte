<script>
  import { FORMATS } from './constants.js';

  let { onselect } = $props();
</script>

<div class="mt-20 text-center font-bold">
  <p class="mb-4">What format would you like cards from?</p>
  <div class="max-w-xs mx-auto">
    {#each FORMATS as format}
      <button
        class="border border-theme-color hover:border-dark-gray dark:hover:border-white duration-100 rounded-sm h-8 mt-4 uppercase font-extrabold whitespace-nowrap text-sm min-w-full"
        onclick={() => onselect(format)}
      >
        {format}
      </button>
    {/each}
  </div>
</div>
