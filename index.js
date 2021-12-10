const internalIp = require('internal-ip');
const ffmpeg = require('fluent-ffmpeg');
const MediaServer = require('medooze-media-server');
const { SDPInfo, MediaInfo, CodecInfo } = require('semantic-sdp');
const express = require('express');
const dgram = require('dgram');
const WebSocket = require('ws');

const delay = (timeout) =>
  new Promise((resolve) => setTimeout(resolve, timeout));

(async () => {
  const telemetrySocket = dgram.createSocket('udp4');
  telemetrySocket.bind(8890);

  const controlSocket = dgram.createSocket('udp4');
  controlSocket.bind(8001);
  const DRONE_COMMAND_HOST = '192.168.10.1';
  const DRONE_COMMAND_PORT = 8889;

  const send = (command) => {
    controlSocket.send(
      command,
      0,
      command.length,
      DRONE_COMMAND_PORT,
      DRONE_COMMAND_HOST,
      (error) => {
        if (error) throw new Error(error);
      }
    );
  };

  send('command');
  send('streamon');

  await delay(1000);

  setInterval(() => send('streamon'), 1000);

  MediaServer.enableLog(false);
  MediaServer.enableDebug(false);
  MediaServer.enableUltraDebug(false);

  const ip = process.env.IP_ADDRESS || internalIp.v4.sync();
  const endpoint = MediaServer.createEndpoint(ip);

  const media = new MediaInfo('video', 'video');
  media.addCodec(new CodecInfo('h264', 96));

  const rtpPort = process.env.RTP_PORT || 10100;
  const streamer = MediaServer.createStreamer();
  const session = streamer.createSession(media, {
    local: {
      port: rtpPort
    }
  });

  const app = express();
  app.use(express.static('public'));
  app.use(express.text());

  app.post('/stream', (req, res) => {
    const offer = SDPInfo.parse(req.body);

    const transport = endpoint.createTransport(offer);
    transport.setRemoteProperties(offer);

    const answer = offer.answer({
      dtls: transport.getLocalDTLSInfo(),
      ice: transport.getLocalICEInfo(),
      candidates: transport.getLocalCandidates(),
      capabilities: MediaServer.getDefaultCapabilities()
    });
    transport.setLocalProperties(answer);
    const outgoingStream = transport.createOutgoingStream({
      audio: false,
      video: true
    });
    const [outgoingStreamTrack] = outgoingStream.getVideoTracks();
    outgoingStreamTrack.attachTo(session.getIncomingStreamTrack());
    answer.addStream(outgoingStream.getStreamInfo());

    res.json({
      type: 'answer',
      sdp: answer.toString()
    });
  });

  let ffmpegProcess;

  const terminateMainProcess = () => {
    console.log('Terminated gracefully');
    process.exit();
  };

  const terminateGracefully = () => {
    send('stop');
    send('streamoff');
    telemetrySocket.close(() => {
      controlSocket.close(() => {
        if (ffmpegProcess) {
          ffmpegProcess.on('error', terminateMainProcess);
          ffmpegProcess.kill();
        } else {
          terminateMainProcess();
        }
      });
    });
  };

  const telloVideoStream =
    process.env.TELLO_VIDEO_STREAM || 'udp://192.168.10.1:11111';
  try {
    ffmpegProcess = ffmpeg(telloVideoStream)
      .videoCodec('copy')
      .format('rtp')
      .output(`rtp://${ip}:${rtpPort}`)
      .run();
  } catch (error) {
    console.error(error);
    terminateGracefully();
  }

  await delay(1000);

  const wss = new WebSocket.Server({ port: 8080 });
  wss.on('connection', (ws) => {
    telemetrySocket.on('message', (data) => {
      ws.send(data.toString());
    });
    ws.on('message', (data) => {
      const message = data.toString();
      console.log(message);
      send(message);
    });
  });

  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log(`Listening on ${ip}:${listener.address().port}`);
  });

  process.on('SIGINT', () => {
    console.log('\nCaught interrupt signal');
    terminateGracefully();
  });

  process.on('uncaughtException', (error) => {
    console.error(error);
    terminateGracefully();
  });
})();
