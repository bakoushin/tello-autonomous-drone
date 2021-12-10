'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  if (!window.__drone__) {
    return;
  }

  const loadingDetails = document.getElementById('loading-details');
  loadingDetails.textContent = 'Initializing TensorFlow';

  const activatedSound = new Audio('audio/autonomous-mode-activated.mp3');
  const deactivatedSound = new Audio('audio/autonomous-mode-deactivated.mp3');

  const personDetectedSound = new Audio('audio/person-detected.mp3');
  const personLostSound = new Audio('audio/person-lost.mp3');

  const video = document.getElementById('video');
  const tracking = document.getElementById('tracking');
  const ctx = tracking.getContext('2d');

  const host = window.location.hostname;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const socket = new WebSocket(`${protocol}://${host}:8080`);

  const model = poseDetection.SupportedModels.MoveNet;
  const detector = await poseDetection.createDetector(model, {
    modelUrl: 'model/model.json',
    minPoseScore: 0.4
  });

  // Warm up the model with an empty canvas
  const estimationConfig = { flipHorizontal: false };
  await detector.estimatePoses(tracking, estimationConfig);

  const TARGET_HEIGHT = 300; // cm

  const centerX = tracking.width / 2;
  const centerY = tracking.height / 2;

  const outputLimits = [-99, 99];
  const pidYaw = new PID(1.0, 0, 0, 0, { outputLimits });
  const pidX = new PID(0.1, 0, 0, 0, { outputLimits });
  const pidY = new PID(1.0, 0, 0, 0, { outputLimits });
  const pidHeight = new PID(1.0, 0, 0, 0, { outputLimits });

  let kfX = new KalmanFilter();
  let kfY = new KalmanFilter();
  let kfHeight = new KalmanFilter();

  let lr = 0;
  let ud = 0;
  let fb = 0;
  let yaw = 0;

  const resetTrackingVariables = () => {
    lr = 0;
    fb = 0;
    yaw = 0;

    pidYaw.reset();
    pidX.reset();
    pidY.reset();

    kfX = new KalmanFilter();
    kfY = new KalmanFilter();
  };

  const LOSING_THRESHOLD = 1500; // ms

  let isFollowing = false;
  let followingLostTimestamp = Infinity;

  window.__drone__.autonomousMode = false;
  window.__drone__.toggleAutonomousMode = (value) => {
    if (value !== undefined) {
      window.__drone__.autonomousMode = value;
    } else {
      window.__drone__.autonomousMode = !window.__drone__.autonomousMode;
    }
    if (window.__drone__.autonomousMode) {
      window.__drone__.play(activatedSound);
    } else {
      window.__drone__.play(deactivatedSound);
      socket.send(`stop`);
      resetTrackingVariables();
      pidHeight.reset();
      kfHeight = new KalmanFilter();
    }
    isFollowing = false;
    followingLostTimestamp = Infinity;
  };

  const COLOR = '#fff';

  const drawBox = (top, right, bottom, left, frameSize) => {
    ctx.save();

    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;

    const pixel = Math.sqrt(tracking.width * tracking.height) / 100;
    ctx.lineWidth = 0.4 * pixel;
    ctx.beginPath();

    ctx.moveTo(left, top + frameSize);
    ctx.lineTo(left, top);
    ctx.lineTo(left + frameSize, top);

    ctx.moveTo(right, top + frameSize);
    ctx.lineTo(right, top);
    ctx.lineTo(right - frameSize, top);

    ctx.moveTo(left, bottom - frameSize);
    ctx.lineTo(left, bottom);
    ctx.lineTo(left + frameSize, bottom);

    ctx.moveTo(right, bottom - frameSize);
    ctx.lineTo(right, bottom);
    ctx.lineTo(right - frameSize, bottom);

    ctx.stroke();

    ctx.restore();
  };

  const drawCross = (x, y, size, gap = 0) => {
    ctx.save();

    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;

    const pixel = Math.sqrt(tracking.width * tracking.height) / 100;
    ctx.lineWidth = 0.2 * pixel;
    ctx.beginPath();

    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + size);
    ctx.moveTo(x, y - gap);
    ctx.lineTo(x, y - gap - size);
    ctx.moveTo(x - gap, y);
    ctx.lineTo(x - gap - size, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + size, y);

    ctx.stroke();

    ctx.restore();
  };

  const autonomousTracking = async () => {
    if (!window.__drone__.autonomousMode) {
      return;
    }

    const crossSize = 0.02 * Math.min(tracking.width, tracking.height);
    const gap = crossSize;
    drawCross(centerX, centerY, crossSize, gap);

    const height = kfHeight.filter(window.__drone__.height);
    const zError = ((height - TARGET_HEIGHT) / TARGET_HEIGHT) * 100;
    ud = Math.floor(pidHeight.update(zError));

    try {
      const [pose] = await detector.estimatePoses(video, estimationConfig);

      if (pose) {
        followingLostTimestamp = Infinity;
        if (!isFollowing) {
          if (!window.__drone__.isPlaying) {
            window.__drone__.play(personDetectedSound);
          }
          isFollowing = true;
        }

        const [
          nose,
          leftEye,
          rightEye,
          leftEar,
          rightEar,
          left_shoulder,
          rightShoulder,
          leftElbow,
          rightElbow,
          leftWrist,
          rightWrist,
          leftHip,
          rightHip,
          leftKnee,
          rightKnee,
          leftAnkle,
          rightAnkle
        ] = pose.keypoints;

        const leftEarX = leftEar.x;
        const leftEarY = leftEar.y;
        const rightEarX = rightEar.x;
        const rightEarY = rightEar.y;
        const leftAnkleY = leftAnkle.y;
        const rightAnkleY = rightAnkle.y;

        const headWidth = Math.abs(leftEarX - rightEarX);

        let left = Math.min(leftEarX, rightEarX) - 0.1 * headWidth;
        let right = Math.max(leftEarX, rightEarX) + 0.1 * headWidth;
        const top = Math.min(leftEarY, rightEarY) - 1.1 * headWidth;
        const expectedHeight = top + 12 * headWidth;
        const bottom =
          Math.max(leftAnkleY, rightAnkleY, expectedHeight) + 0.1 * headWidth;

        const proportionalFrameSize = 0.5 * headWidth;
        const minimalFrameSize =
          0.02 * Math.min(tracking.width, tracking.height);
        const frameSize = Math.max(proportionalFrameSize, minimalFrameSize);
        const gap = right - left > 1.5 * frameSize ? 0 : 0.75 * frameSize;
        left -= gap;
        right += gap;

        drawBox(
          top,
          right - 0.8 * (left - right),
          bottom + 1.1 * headWidth,
          left + 0.8 * (left - right),
          frameSize
        );

        const x = kfX.filter(left + 0.5 * (right - left));
        const y = kfY.filter(top + 0.5 * (bottom - top));
        drawCross(x, y, 0.8 * frameSize);

        const yError = ((y - centerY) / centerY) * 100;
        fb = Math.floor(pidY.update(yError));
        const [fLimit, bLimit] = outputLimits;
        if (fb < 0) {
          // forward movement tuning
          fb = Math.max(fLimit, Math.floor(2 * fb));
        } else {
          // backward movement tuning
          fb = Math.min(bLimit, Math.floor(1.5 * fb));
        }

        const xError = ((x - centerX) / centerX) * 100;
        yaw = -Math.floor(pidYaw.update(xError));
        lr = Math.floor(pidX.update(xError));
      } else {
        resetTrackingVariables();

        if (isFollowing) {
          if (followingLostTimestamp === Infinity) {
            followingLostTimestamp = Date.now();
          } else if (Date.now() - followingLostTimestamp >= LOSING_THRESHOLD) {
            if (!window.__drone__.isPlaying) {
              window.__drone__.play(personLostSound);
            }
            isFollowing = false;
          }
        }
      }

      const message = `rc ${lr} ${fb} ${ud} ${yaw}`;
      if (window.__drone__.isFlying) {
        socket.send(message);
      }
    } catch (error) {
      console.error(error);
      resetTrackingVariables();
    }
  };

  const handleFrame = async () => {
    if (video.readyState >= 2) {
      if (!window.__drone__.isReady) {
        window.__drone__.ready();
      }

      ctx.clearRect(0, 0, tracking.width, tracking.height);

      await autonomousTracking();
    }

    setTimeout(handleFrame, 0);
  };

  loadingDetails.textContent = 'Waiting for video from drone';

  handleFrame();
});
