"use strict";

let gl, surface, surfaceCam, soundSphere, shProgram, spaceball, stereoCam;
let video, webcamTexture;
let socket = null;
let sensorRotationMatrix = m4.identity();

let audioCtx, panner, filter, source, audioBuffer;
let isPlaying = false;
let filterEnabled = false;

function init() {
  let canvas = document.getElementById("webglcanvas");
  gl = canvas.getContext("webgl");
  if (!gl) return;

  initGL();
  initWebcam();
  spaceball = new TrackballRotator(canvas, draw, 0);

  ["eyeSep", "fov", "near", "conv"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      updateStereoParams();
      draw();
    });
  });

  requestAnimationFrame(renderLoop);
}

async function initAudio() {
  if (audioCtx) return;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  panner = audioCtx.createPanner();
  panner.panningModel = "HRTF";
  panner.distanceModel = "inverse";
  panner.refDistance = 1;
  panner.maxDistance = 10000;
  panner.rolloffFactor = 1;

  filter = audioCtx.createBiquadFilter();
  filter.type = "notch";
  filter.frequency.value = Number(document.getElementById("notchFreq").value);
  filter.Q.value = 1;

  const response = await fetch("./music.mp3");
  const arrayBuffer = await response.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
}

function playAudio() {
  if (!audioCtx) {
    initAudio().then(togglePlayback);
  } else {
    togglePlayback();
  }
}

function togglePlayback() {
  const btn = document.getElementById("playBtn");

  if (audioCtx.state === "running" && isPlaying) {
    audioCtx.suspend();
    isPlaying = false;
    btn.innerText = "Play Music";
  } else if (audioCtx.state === "suspended" && !isPlaying) {
    audioCtx.resume();
    isPlaying = true;
    btn.innerText = "Pause Music";
  } else if (!isPlaying) {
    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = true;

    updateAudioGraph();
    source.start(0);
    isPlaying = true;
    btn.innerText = "Pause Music";
  }
}

function toggleFilter(useFilter) {
  filterEnabled = useFilter;
  updateAudioGraph();
}

function updateNotchFreq(value) {
  if (filter && audioCtx) {
    filter.frequency.setTargetAtTime(Number(value), audioCtx.currentTime, 0.05);
  }
}

function updateAudioGraph() {
  if (!panner || !source) return;
  source.disconnect();
  panner.disconnect();
  filter.disconnect();

  source.connect(panner);
  if (filterEnabled) {
    panner.connect(filter);
    filter.connect(audioCtx.destination);
  } else {
    panner.connect(audioCtx.destination);
  }
}

function connectSensor() {
  const ip = document.getElementById("ipAddr").value;
  const status = document.getElementById("status");

  if (socket) socket.close();

  socket = new WebSocket(
    `ws://${ip}/sensor/connect?type=android.sensor.magnetic_field`,
  );

  socket.onopen = () => {
    status.innerText = "Connected";
    status.style.color = "green";
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.values) {
      updateRotationFromMagnetometer(data.values);
    }
  };

  socket.onerror = () => {
    status.innerText = "Connection Error";
    status.style.color = "red";
  };
}

function updateRotationFromMagnetometer(values) {
  let mag = m4.normalize([values[0], values[1], values[2]]);

  let up = [0, 1, 0];
  let xAxis = m4.normalize(m4.cross(up, mag));
  let yAxis = m4.normalize(m4.cross(mag, xAxis));

  sensorRotationMatrix = [
    xAxis[0],
    xAxis[1],
    xAxis[2],
    0,
    yAxis[0],
    yAxis[1],
    yAxis[2],
    0,
    mag[0],
    mag[1],
    mag[2],
    0,
    0,
    0,
    0,
    1,
  ];
}

function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  shProgram = {
    prog: prog,
    iAttribVertex: gl.getAttribLocation(prog, "vertex"),
    iAttribTexCoord: gl.getAttribLocation(prog, "texCoord"),
    iModelViewProjectionMatrix: gl.getUniformLocation(
      prog,
      "ModelViewProjectionMatrix",
    ),
    iColor: gl.getUniformLocation(prog, "color"),
    uUseTexture: gl.getUniformLocation(prog, "uUseTexture"),
  };

  surface = new Model("Neovius");
  surface.BufferData(CreateSurfaceData());

  surfaceCam = new Model("WebcamQuad");
  surfaceCam.BufferData(CreateWebcamRectData());

  soundSphere = new Model("SoundSphere");
  soundSphere.BufferData(CreateSphereData(0.5, 20, 20));

  updateStereoParams();
  gl.enable(gl.DEPTH_TEST);
}

function updateStereoParams() {
  stereoCam = new StereoCamera(
    parseFloat(document.getElementById("eyeSep").value),
    parseFloat(document.getElementById("conv").value),
    1.0,
    deg2rad(parseFloat(document.getElementById("fov").value)),
    parseFloat(document.getElementById("near").value),
    100.0,
  );
}

function initWebcam() {
  video = document.createElement("video");
  video.autoplay = true;
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
      video.play();
      webcamTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    })
    .catch(() => {
      console.log("Webcam access denied or unavailable.");
    });
}

function renderLoop() {
  draw();
  requestAnimationFrame(renderLoop);
}

function draw() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(shProgram.prog);

  if (webcamTexture && video.readyState >= video.HAVE_CURRENT_DATA) {
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    let ortho = m4.orthographic(0, 1, 0, 1, -1, 1);
    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, ortho);
    gl.uniform1i(shProgram.uUseTexture, 1);
    gl.disable(gl.DEPTH_TEST);
    surfaceCam.Draw();
    gl.enable(gl.DEPTH_TEST);
  }

  gl.uniform1i(shProgram.uUseTexture, 0);

  let modelView = spaceball.getViewMatrix();
  let combinedRotation = m4.multiply(modelView, sensorRotationMatrix);

  let surfaceWorld = m4.translation(0, 0, -stereoCam.convergence);

  let soundLocalRotation = m4.multiply(m4.identity(), combinedRotation);
  let orbitRadiusTransform = m4.translation(4, 0, 0);
  let soundPositionLocal = m4.multiply(
    soundLocalRotation,
    orbitRadiusTransform,
  );

  let soundWorld = m4.multiply(surfaceWorld, soundPositionLocal);

  let localPos = m4.transformPoint(soundPositionLocal, [0, 0, 0]);
  if (panner && audioCtx) {
    panner.positionX.value = localPos[0];
    panner.positionY.value = localPos[1];
    panner.positionZ.value = localPos[2];
  }

  gl.colorMask(true, false, false, true);
  renderSide(true, surfaceWorld, soundWorld);

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.colorMask(false, true, true, true);
  renderSide(false, surfaceWorld, soundWorld);

  gl.colorMask(true, true, true, true);
}

function renderSide(isLeft, surfaceWorld, soundWorld) {
  let projection = stereoCam.calcFrustum(isLeft);
  let eyeTranslation = m4.translation(
    isLeft ? stereoCam.eyeSeparation / 2 : -stereoCam.eyeSeparation / 2,
    0,
    0,
  );

  let mvpSurface = m4.multiply(
    projection,
    m4.multiply(eyeTranslation, surfaceWorld),
  );
  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvpSurface);
  gl.uniform4fv(shProgram.iColor, [0.2, 0.2, 0.2, 1]);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  surface.Draw();
  gl.disable(gl.POLYGON_OFFSET_FILL);
  gl.uniform4fv(shProgram.iColor, [1, 1, 1, 1]);
  surface.DrawWireframe();

  let mvpSound = m4.multiply(
    projection,
    m4.multiply(eyeTranslation, soundWorld),
  );
  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvpSound);
  gl.uniform4fv(shProgram.iColor, [1.0, 0.3, 0.0, 1]);
  soundSphere.Draw();
  gl.uniform4fv(shProgram.iColor, [1, 1, 1, 1]);
  soundSphere.DrawWireframe();
}

function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  return prog;
}

function deg2rad(deg) {
  return (deg * Math.PI) / 180;
}
