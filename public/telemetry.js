'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.__drone__) {
    return;
  }

  const COLOR = '#fff';
  const COLOR_BATTERY_DANGER = '#ff3d00';
  const COLOR_BATTERY_WARNING = '#fdd835';
  const COLOR_RECORDING_INDICATOR = '#ff3d00';

  const DANGER_BATTERY_THRESHOLD = 10;
  const WARNING_BATTERY_THRESHOLD = 20;

  const dangerBatterySound = new Audio('audio/danger-battery.mp3');
  const warningBatterySound = new Audio('audio/warning-battery.mp3');

  const canvas = document.getElementById('telemetry');
  const ctx = canvas.getContext('2d');
  const DPR = window.devicePixelRatio || 1;

  function setCanvasSize() {
    const { width: pxWidth, height: pxHeight } = canvas.getBoundingClientRect();
    canvas.width = pxWidth * DPR;
    canvas.height = pxHeight * DPR;
  }
  setCanvasSize();
  window.addEventListener('resize', setCanvasSize);

  let state = {
    height: null,
    battery: null,
    isRecording: false,
    isAutonomousMode: false
  };

  //'pitch:%d;roll:%d;yaw:%d;vgx:%d;vgy%d;vgz:%d;templ:%d;temph:%d;
  //tof:%d;h:%d;bat:%d;baro: %.2f; time:%d;agx:%.2f;agy:%.2f;agz:%.2f;\r\n'
  const host = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${host}:8080`);
  socket.addEventListener('message', ({ data }) => {
    const [
      pitch,
      roll,
      yaw,
      speedX,
      speedY,
      speedZ,
      tempLow,
      tempHigh,
      tof,
      height,
      battery,
      baro,
      time,
      accelerationX,
      accelerationY,
      accelerationZ
    ] = data
      .toString()
      .trim()
      .split(';')
      .map((v) => Number(v.split(':')[1]));

    state.height = height;
    state.battery = battery;

    window.__drone__.isFlying = height > 0;
    window.__drone__.height = height;

    playBatterySound(battery);
  });

  updateRecorderState(state);

  updateAutonomousModeState(state);

  drawAll();

  function updateRecorderState(state) {
    state.isRecording =
      window.__drone__ &&
      window.__drone__.mediaRecorder &&
      window.__drone__.mediaRecorder.state === 'recording';

    requestAnimationFrame(() => updateRecorderState(state));
  }

  function updateAutonomousModeState(state) {
    state.isAutonomousMode =
      window.__drone__ && window.__drone__.autonomousMode;
    requestAnimationFrame(() => updateAutonomousModeState(state));
  }

  function drawAll() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;
    ctx.globalAlpha = 1;

    drawHeight(state.height);
    drawBattery(state.battery);
    drawRecordingMode(state.isRecording);
    drawAutonomousMode(state.isAutonomousMode);
    requestAnimationFrame(drawAll);
  }

  function drawHeight(height) {
    if (height === null) {
      return;
    }

    ctx.save();

    const STEPS_ON_SCREEN = 30;
    const MARKER_STEP = 5;
    const step = canvas.height / STEPS_ON_SCREEN;

    const start = Math.floor(height) - STEPS_ON_SCREEN / 2;
    const end = Math.ceil(height) + STEPS_ON_SCREEN / 2;

    const pixel = Math.sqrt(canvas.width * canvas.height) / 100;

    ctx.lineWidth = 0.4 * pixel;
    ctx.beginPath();
    for (let i = start; i <= end; i++) {
      const y =
        canvas.height -
        (Math.floor(i * step) + (STEPS_ON_SCREEN / 2) * step - height * step);
      if (i % MARKER_STEP === 0) {
        ctx.moveTo(0, y);
        ctx.lineTo(8 * pixel, y);
        ctx.font = `${5 * pixel}px monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, 8.5 * pixel, y);
      } else {
        ctx.moveTo(0, y);
        ctx.lineTo(3 * pixel, y);
      }
    }

    const textWidth = ctx.measureText(end).width;

    const canvasMiddle = canvas.height * 0.5;
    ctx.moveTo(10 * pixel + textWidth + 5 * pixel, canvasMiddle);
    ctx.lineTo(10 * pixel + textWidth + 5 * pixel, canvasMiddle + 3 * pixel);
    ctx.lineTo(10 * pixel + textWidth, canvasMiddle);
    ctx.lineTo(10 * pixel + textWidth + 5 * pixel, canvasMiddle - 3 * pixel);
    ctx.lineTo(10 * pixel + textWidth + 5 * pixel, canvasMiddle);

    ctx.font = `${8 * pixel}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`${height}cm`, 16 * pixel + textWidth, canvasMiddle * 1.005);

    ctx.stroke();

    ctx.restore();
  }

  function drawBattery(battery) {
    if (battery === null) {
      return;
    }

    ctx.save();

    const pixel = Math.sqrt(canvas.width * canvas.height) / 100;

    const width = 10 * pixel;
    const height = 5 * pixel;
    const offsetX = canvas.width - width - height * 0.666;
    const offsetY = height * 0.5;

    ctx.lineWidth = 0.4 * pixel;
    ctx.strokeRect(offsetX, offsetY, width, height);
    ctx.fillRect(
      offsetX + width,
      offsetY + offsetY * 0.5,
      width * 0.125,
      height * 0.5
    );

    ctx.fillStyle = batteryFillStyle(battery);
    ctx.fillRect(
      offsetX + width * 0.1,
      offsetY + width * 0.1,
      ((width * battery) / 100) * 0.8,
      height - width * 0.2
    );

    ctx.font = `${height}px monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${Math.round(battery)}%`,
      offsetX - width * 0.2,
      offsetY + height * 0.55
    );

    ctx.restore();
  }

  function batteryFillStyle(battery) {
    if (battery <= DANGER_BATTERY_THRESHOLD) {
      return COLOR_BATTERY_DANGER;
    } else if (battery <= WARNING_BATTERY_THRESHOLD) {
      return COLOR_BATTERY_WARNING;
    } else {
      return COLOR;
    }
  }

  let dangerPlayed = false;
  let warningPlayed = false;

  function playBatterySound(battery) {
    if (battery <= DANGER_BATTERY_THRESHOLD) {
      if (!dangerPlayed) {
        dangerPlayed = true;
        window.__drone__.play(dangerBatterySound);
      }
    } else if (battery <= WARNING_BATTERY_THRESHOLD) {
      if (!warningPlayed) {
        warningPlayed = true;
        window.__drone__.play(warningBatterySound);
      }
    } else {
      dangerPlayed = false;
      warningPlayed = false;
    }
  }

  const recordingIndicatorState = {
    visible: true,
    lastTimestamp: 0
  };

  function drawRecordingMode(isRecording) {
    if (!isRecording) {
      return;
    }

    ctx.save();

    const pixel = Math.sqrt(canvas.width * canvas.height) / 100;

    const height = 5 * pixel;
    const offsetY = height * 0.5;

    const x = canvas.width / 2;
    const y = offsetY + height * 0.55;

    if (Date.now() - recordingIndicatorState.lastTimestamp > 500) {
      recordingIndicatorState.lastTimestamp = Date.now();
      recordingIndicatorState.visible = !recordingIndicatorState.visible;
    }

    if (recordingIndicatorState.visible) {
      ctx.fillStyle = COLOR_RECORDING_INDICATOR;
      ctx.beginPath();
      ctx.lineWidth = 0.4 * pixel;
      ctx.moveTo(x - 1.5 * height, y);
      ctx.arc(x - 1.5 * height, y, 1.5 * pixel, 0, Math.PI * 2, true);
      ctx.fill();
    }

    ctx.fillStyle = COLOR;
    ctx.font = `${height}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('REC', x, y);

    ctx.restore();
  }

  const automomousModeIndicatorState = {
    visible: true,
    lastTimestamp: 0
  };

  function drawAutonomousMode(isAutonomousMode) {
    if (!isAutonomousMode) {
      return;
    }

    if (Date.now() - automomousModeIndicatorState.lastTimestamp > 500) {
      automomousModeIndicatorState.lastTimestamp = Date.now();
      automomousModeIndicatorState.visible =
        !automomousModeIndicatorState.visible;
    }

    if (!automomousModeIndicatorState.visible) {
      return;
    }

    ctx.save();

    const pixel = Math.sqrt(canvas.width * canvas.height) / 100;

    const height = 5 * pixel;
    const offsetY = canvas.height - height * 1.5;

    const x = canvas.width / 2;
    const y = offsetY + height * 0.55;

    ctx.fillStyle = COLOR;
    ctx.font = `${height}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AUTONOMOUS MODE', x, y);

    ctx.restore();
  }
});
