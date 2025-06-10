<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  let { history = [] } = $props();
  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      close();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="bg-black bg-opacity-70 fixed top-0 left-0 overflow-x-hidden overflow-y-auto block w-full h-full"
  onclick={close}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="flex items-center relative transform-none w-screen max-w-none h-full min-h-[calc(100%-1rem)] m-0 sm:mt-7 sm:max-w-lg sm:w-auto sm:m-auto sm:min-h-[calc(100%-3.5rem)] sm:h-[calc(100%-3.5rem)] lg:max-w-3xl"
    onclick={(e) => e.stopPropagation()}
  >
    <div
      class="flex flex-col relative bg-clip-padding bg-light-gray dark:bg-dark-gray rounded-sm xs:rounded-none w-full xs:h-full md:w-200 max-h-full overflow-hidden"
    >
      <div
        class="flex shrink-0 border-b border-b-dark-gray dark:border-b-white w-full p-4 justify-between items-center text-xl font-bold text-theme-color"
      >
        <h3>History</h3>
        <button
          onclick={close}
          class="flex justify-center flex-row text-light-gray dark:text-dark-gray bg-theme-color bg-opacity-60 rounded-sm cursor-pointer hover:bg-opacity-80 duration-100 w-7 h-7"
          >X</button
        >
      </div>
      <div
        class="flex flex-col flex-auto items-center relative p-4 w-auto xs:overflow-y-auto overflow-y-auto"
      >
        {#each history
          .slice()
          .reverse() as item, index (item.level + '-' + index)}
          <div class="w-full">
            <div>
              <div class="text-theme-color w-full mb-5">
                <h3>
                  Level: <span class="text-dark-gray dark:text-white"
                    >{item.level}</span
                  >
                </h3>
              </div>
              <div class="flex flex-col items-center">
                <a
                  href={item.card.scryfall_uri}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={item.cardImage} alt={item.card.name} />
                </a>
              </div>
            </div>
            {#if index < history.length - 1}
              <hr class="bg-theme-color border-0 h-px m-7" />
            {/if}
          </div>
        {/each}
      </div>
      <div
        class="flex flex-wrap shrink-0 justify-end items-center p-3 border-t border-t-dark-gray dark:border-t-white"
      >
        <button
          onclick={close}
          class="py-[7px] px-5 flex justify-center flex-row border border-theme-color text-theme-color text-xs uppercase font-extrabold whitespace-nowrap rounded-sm hover:border-dark-gray dark:hover:border-white duration-100 w-26 h-8"
          >Close</button
        >
      </div>
    </div>
  </div>
</div>
