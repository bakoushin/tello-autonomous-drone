'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const hints = document.querySelector('.hints');
  hints.addEventListener('click', (event) => {
    if (event.target !== hints) {
      return;
    }
    hints.classList.add('hidden');
  });
});
