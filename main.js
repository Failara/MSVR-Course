"use strict";

let gl, surface, surfaceCam, shProgram, spaceball, stereoCam;
let video, webcamTexture;

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
  navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
    video.srcObject = stream;
    video.play();
    webcamTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
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
  let world = m4.multiply(
    m4.translation(0, 0, -stereoCam.convergence),
    modelView,
  );

  gl.colorMask(true, false, false, true);
  renderSide(true, world);

  gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.colorMask(false, true, true, true);
  renderSide(false, world);

  gl.colorMask(true, true, true, true);
}

function renderSide(isLeft, world) {
  let projection = stereoCam.calcFrustum(isLeft);
  let eyeTranslation = m4.translation(
    isLeft ? stereoCam.eyeSeparation / 2 : -stereoCam.eyeSeparation / 2,
    0,
    0,
  );
  let mvp = m4.multiply(projection, m4.multiply(eyeTranslation, world));

  gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, mvp);

  gl.uniform4fv(shProgram.iColor, [0.2, 0.2, 0.2, 1]);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
  surface.Draw();
  gl.disable(gl.POLYGON_OFFSET_FILL);

  gl.uniform4fv(shProgram.iColor, [1, 1, 1, 1]);
  surface.DrawWireframe();
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
