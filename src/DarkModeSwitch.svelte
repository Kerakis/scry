<script>
  let darkMode = $state(
    localStorage.theme === 'dark' ||
      (!('theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  $effect(() => {
    localStorage.theme = darkMode ? 'dark' : 'light';
    document.documentElement.classList.remove(darkMode ? 'light' : 'dark');
    document.documentElement.classList.add(darkMode ? 'dark' : 'light');
  });
</script>

<label class="flex items-center cursor-pointer">
  <div class="relative">
    <input type="checkbox" class="hidden" bind:checked={darkMode} />
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="absolute w-6 h-6 fill-theme-color transition-opacity duration-300 {darkMode
        ? 'opacity-0'
        : 'opacity-1'}"
      ><path
        d="M7 12a5 5 0 1 1 5 5 5 5 0 0 1-5-5zm5-7a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v1a1 1 0 0 0 1 1zm-1 15v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-2 0zm10-9h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zM3 13h1a1 1 0 0 0 0-2H3a1 1 0 0 0 0 2zm14.657-5.657a1 1 0 0 0 .707-.293l.707-.707a1 1 0 1 0-1.414-1.414l-.707.707a1 1 0 0 0 .707 1.707zM5.636 16.95l-.707.707a1 1 0 1 0 1.414 1.414l.707-.707a1 1 0 0 0-1.414-1.414zm11.314 0a1 1 0 0 0 0 1.414l.707.707a1 1 0 0 0 1.414-1.414l-.707-.707a1 1 0 0 0-1.414 0zM5.636 7.05A1 1 0 0 0 7.05 5.636l-.707-.707a1 1 0 0 0-1.414 1.414z"
      /></svg
    >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      class="absolute w-6 h-6 fill-theme-color transition-opacity duration-300 {darkMode
        ? 'opacity-1'
        : 'opacity-0'}"
      ><path
        d="M11.993,3a9.326,9.326,0,0,0-1.138,4.477,8.8,8.8,0,0,0,8.569,9.015c.2,0,.385-.017.576-.03A8.5,8.5,0,0,1,12.569,21,8.8,8.8,0,0,1,4,11.985,8.83,8.83,0,0,1,11.993,3Z"
      /></svg
    >
  </div>
</label>
