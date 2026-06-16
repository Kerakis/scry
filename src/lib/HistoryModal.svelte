<script>
  import { onMount, onDestroy } from 'svelte';

  let { history = [], onclose } = $props();
  const reversedHistory = $derived([...history].reverse());

  /** @type {HTMLElement | null} */
  let modalEl = null;
  /** @type {Element | null} */
  let triggerEl = null;

  const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function close() {
    onclose?.();
  }

  /** @param {KeyboardEvent} event */
  function handleKeydown(event) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'Tab') {
      const focusable = /** @type {HTMLElement[]} */ ([...(modalEl?.querySelectorAll(FOCUSABLE) ?? [])]);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  /** @param {MouseEvent} event */
  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) close();
  }

  /** @param {KeyboardEvent} event */
  function handleBackdropKeydown(event) {
    if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault();
      close();
    }
  }

  onMount(() => {
    triggerEl = document.activeElement;
    const firstFocusable = /** @type {HTMLElement | null} */ (modalEl?.querySelector(FOCUSABLE));
    firstFocusable?.focus();
    document.body.classList.add('overflow-hidden');
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.body.classList.remove('overflow-hidden');
    window.removeEventListener('keydown', handleKeydown);
    /** @type {HTMLElement | null} */ (triggerEl)?.focus();
  });
</script>

<div
  bind:this={modalEl}
  class="bg-black bg-opacity-70 fixed top-0 left-0 overflow-x-hidden overflow-y-auto block w-full h-full"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
  onclick={handleBackdropClick}
  onkeydown={handleBackdropKeydown}
>
  <div
    class="flex items-center relative transform-none w-screen max-w-none h-full min-h-[calc(100%-1rem)] m-0 sm:mt-7 sm:max-w-lg sm:w-auto sm:m-auto sm:min-h-[calc(100%-3.5rem)] sm:h-[calc(100%-3.5rem)] lg:max-w-3xl"
  >
    <div
      class="flex flex-col relative bg-clip-padding bg-light-gray dark:bg-dark-gray rounded-sm xs:rounded-none w-full xs:h-full md:w-200 max-h-full overflow-hidden"
      role="document"
    >
      <div
        class="flex shrink-0 border-b border-b-dark-gray dark:border-b-white w-full p-4 justify-between items-center text-xl font-bold text-theme-color"
      >
        <h3 id="modal-title">History</h3>
        <button
          type="button"
          onclick={close}
          aria-label="Close history modal"
          class="flex justify-center flex-row text-light-gray dark:text-dark-gray bg-theme-color bg-opacity-60 rounded-sm cursor-pointer hover:bg-opacity-80 duration-100 w-7 h-7"
        >
          X
        </button>
      </div>

      <div
        class="flex flex-col flex-auto items-center relative p-4 w-auto xs:overflow-y-auto overflow-y-auto"
      >
        {#each reversedHistory as item, index (item.level + '-' + index)}
          <div class="w-full">
            <div>
              <div class="text-theme-color w-full mb-5">
                <h3>
                  Level: <span class="text-dark-gray dark:text-white">{item.level}</span>
                </h3>
              </div>
              <div class="flex flex-col items-center">
                <a
                  href={item.scryfall_uri || item.card?.scryfall_uri}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="View {item.card?.name || 'card'} on Scryfall"
                >
                  <img src={item.cardImage} alt={item.card?.name || 'Card'} />
                </a>
              </div>
            </div>
            {#if index < reversedHistory.length - 1}
              <hr class="bg-theme-color border-0 h-px m-7" />
            {/if}
          </div>
        {/each}
      </div>

      <div
        class="flex flex-wrap shrink-0 justify-end items-center p-3 border-t border-t-dark-gray dark:border-t-white"
      >
        <button
          type="button"
          onclick={close}
          class="py-1.75 px-5 flex justify-center flex-row border border-theme-color text-theme-color text-xs uppercase font-extrabold whitespace-nowrap rounded-sm hover:border-dark-gray dark:hover:border-white duration-100 w-26 h-8"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</div>
