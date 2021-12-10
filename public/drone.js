'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  window.__drone__ = {};
  const drone = window.__drone__;

  const video = document.getElementById('video');
  const telemetry = document.getElementById('telemetry');
  const tracking = document.getElementById('tracking');
  const controls = document.getElementById('controls');
  const elements = [video, telemetry, tracking, controls];

  drone.height = 0;

  drone.isReady = false;
  drone.ready = () => {
    drone.isReady = true;
    elements.forEach((element) => element.classList.remove('opaque'));
  };

  drone.isPlaying = false;
  let playQueue = Promise.resolve();
  drone.play = (audio) => {
    playQueue = playQueue.then(
      () =>
        new Promise((resolve) => {
          const done = () => {
            audio.removeEventListener('ended', done);
            drone.isPlaying = false;
            resolve();
          };
          audio.addEventListener('ended', done);
          drone.isPlaying = true;
          audio.play();
        })
    );
  };
});
