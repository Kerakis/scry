<script>
  let darkMode =
    localStorage.theme === 'dark' ||
    (!('theme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  let dotClasses = 'bg-white transform translate-x-0';
  let lineClasses = 'bg-gray-400';

  $: {
    localStorage.theme = darkMode ? 'dark' : 'light';
    document.documentElement.classList.remove(darkMode ? 'light' : 'dark');
    document.documentElement.classList.add(darkMode ? 'dark' : 'light');
    dotClasses = darkMode
      ? 'bg-blue-500 transform translate-x-full'
      : 'bg-white transform translate-x-0';
    lineClasses = darkMode ? 'bg-blue-500' : 'bg-gray-400';
  }
</script>

<label class="flex items-center cursor-pointer">
  <div class="relative">
    <input type="checkbox" class="hidden" bind:checked={darkMode} />
    <div
      class="toggle__line w-10 h-4 rounded-full shadow-inner {lineClasses}"
    ></div>
    <div
      class="toggle__dot absolute w-6 h-6 rounded-full shadow inset-y-0 left-0 transition-transform duration-300 {dotClasses}"
    ></div>
  </div>
</label>
