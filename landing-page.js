(() => {
  const tabs = document.querySelectorAll('.lp-tab');
  const mocks = document.querySelectorAll('.lp-mock');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.dataset.tab;
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      mocks.forEach((m) => m.classList.toggle('active', m.dataset.mock === id));
    });
  });
})();
