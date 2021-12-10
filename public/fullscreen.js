'use strict';

window.addEventListener('DOMContentLoaded', () => {
  let isFullscreen = false;

  const elem = document.documentElement;

  const openFullscreen = () => {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
    isFullscreen = true;
  };

  const closeFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
    isFullscreen = false;
  };

  const fullscreenButton = document.getElementById('fullscreen-button');

  fullscreenButton.addEventListener('click', () => {
    if (!isFullscreen) {
      openFullscreen();
    } else {
      closeFullscreen();
    }
  });
});
