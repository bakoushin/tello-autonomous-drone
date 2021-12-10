'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const host = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${host}:8080`);

  const takingOffSound = new Audio('audio/taking-off.mp3');
  const landingSound = new Audio('audio/landing.mp3');
  const emergencyStopSound = new Audio('audio/emergency-stop.mp3');

  const keyState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyS: false,
    KeyA: false,
    KeyD: false
  };

  const sendRC = () => {
    let lr = 0;
    let fb = 0;
    let ud = 0;
    let yaw = 0;

    if (keyState.ArrowUp) fb += 100;
    else if (keyState.ArrowDown) fb -= 100;

    if (keyState.ArrowLeft) lr -= 100;
    else if (keyState.ArrowRight) lr += 100;

    if (keyState.KeyW) ud += 100;
    else if (keyState.KeyS) ud -= 100;

    if (keyState.KeyA) yaw -= 100;
    else if (keyState.KeyD) yaw += 100;

    socket.send(`rc ${lr} ${fb} ${ud} ${yaw}`);
  };

  const keydownCommands = {
    Enter: () => {
      window.__drone__.play(takingOffSound);
      socket.send('takeoff');
    },
    F1: () => {
      window.__drone__.play(emergencyStopSound);
      socket.send('emergency');
      if (window.__drone__.autonomousMode) {
        window.__drone__.toggleAutonomousMode(false);
      }
    },
    Backspace: () => {
      window.__drone__.play(landingSound);
      socket.send('land');
      if (window.__drone__.autonomousMode) {
        window.__drone__.toggleAutonomousMode(false);
      }
    },
    Tab: () => {
      if (!window.__drone__) {
        alert(
          'Cannot record video. Drone state is not initialized.\nNot found `window.__drone__` object. Maybe error in code?'
        );
      }

      const mediaRecorder = window.__drone__.mediaRecorder;

      if (!mediaRecorder) {
        alert(
          'Video recoding is not supported in this browser.\nPlease try Chrome or Firefox.'
        );
      }

      if (mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      } else {
        mediaRecorder.start();
      }
    },
    Space: () => {
      if (!window.__drone__) {
        alert(
          'Cannot toggle autonomous mode. Drone state is not initialized.\nNot found `window.__drone__` object. Maybe error in code?'
        );
      }

      if (window.__drone__.toggleAutonomousMode) {
        window.__drone__.toggleAutonomousMode();
      }
    },
    ArrowUp: () => {
      keyState.ArrowUp = true;
      sendRC();
    },
    ArrowDown: () => {
      keyState.ArrowDown = true;
      sendRC();
    },
    ArrowLeft: () => {
      keyState.ArrowLeft = true;
      sendRC();
    },
    ArrowRight: () => {
      keyState.ArrowRight = true;
      sendRC();
    },
    KeyW: () => {
      keyState.KeyW = true;
      sendRC();
    },
    KeyS: () => {
      keyState.KeyS = true;
      sendRC();
    },
    KeyA: () => {
      keyState.KeyA = true;
      sendRC();
    },
    KeyD: () => {
      keyState.KeyD = true;
      sendRC();
    },
    'Shift+ArrowUp': () => {
      socket.send('flip f');
    },
    'Shift+ArrowDown': () => {
      socket.send('flip b');
    },
    'Shift+ArrowLeft': () => {
      socket.send('flip l');
    },
    'Shift+ArrowRight': () => {
      socket.send('flip r');
    }
  };

  window.addEventListener('keydown', (event) => {
    if (!window.__drone__.isReady) {
      return;
    }

    const { code, shiftKey } = event;
    const commandCode = shiftKey ? `Shift+${code}` : code;
    const command = keydownCommands[commandCode];
    if (!command) {
      return;
    }

    event.preventDefault();
    command();
  });

  const keyupMapping = {
    ArrowUp: () => {
      keyState.ArrowUp = false;
      sendRC();
    },
    ArrowDown: () => {
      keyState.ArrowDown = false;
      sendRC();
    },
    ArrowLeft: () => {
      keyState.ArrowLeft = false;
      sendRC();
    },
    ArrowRight: () => {
      keyState.ArrowRight = false;
      sendRC();
    },
    KeyW: () => {
      keyState.KeyW = false;
      sendRC();
    },
    KeyS: () => {
      keyState.KeyS = false;
      sendRC();
    },
    KeyA: () => {
      keyState.KeyA = false;
      sendRC();
    },
    KeyD: () => {
      keyState.KeyD = false;
      sendRC();
    }
  };

  window.addEventListener('keyup', ({ code }) => {
    if (!window.__drone__.isReady) {
      return;
    }

    const command = keyupMapping[code];
    if (!command) {
      return;
    }

    command();
  });

  const keyboardButton = document.getElementById('keyboard-button');
  const keyboard = document.getElementById('keyboard');

  keyboardButton.addEventListener('click', () => {
    keyboard.classList.toggle('hidden');
  });
});
