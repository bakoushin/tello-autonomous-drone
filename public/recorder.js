'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('video');

  if (!video.captureStream) {
    return;
  }

  let mimeType;
  if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  } else if (MediaRecorder.isTypeSupported('video/webm')) {
    mimeType = 'video/webm';
  }

  if (!mimeType) {
    return;
  }

  const recoringStartedSound = new Audio('audio/recording-started.mp3');
  const recordingStoppedSound = new Audio('audio/recording-stopped.mp3');

  const options = { mimeType };
  const mediaRecorder = new MediaRecorder(video.captureStream(25), options);

  let chunks = [];

  mediaRecorder.ondataavailable = ({ data }) => {
    if (data.size > 0) {
      chunks.push(data);
    }
  };

  mediaRecorder.onstart = () => {
    window.__drone__.play(recoringStartedSound);
  };

  mediaRecorder.onstop = () => {
    window.__drone__.play(recordingStoppedSound);

    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
    chunks = [];
    const extension = mimeType.endsWith('mp4') ? 'mp4' : 'webm';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style = 'display: none';
    a.href = url;
    a.download = `drone-recording.${extension}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (!window.__drone__) {
    return;
  }

  window.__drone__.mediaRecorder = mediaRecorder;
});
