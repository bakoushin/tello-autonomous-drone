'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('video');

  const pc = new RTCPeerConnection({
    sdpSemantics: 'unified-plan'
  });
  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addEventListener('track', (event) => {
    const [stream] = event.streams;
    video.srcObject = stream;
  });

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const res = await fetch('/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: pc.localDescription.sdp
    });
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    const answer = await res.json();
    await pc.setRemoteDescription(answer);
  } catch (error) {
    console.error(error);
  }
});
