"use strict";
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iTexBuffer = gl.createBuffer();
  this.iIndexBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(data.vertexList),
      gl.STATIC_DRAW,
    );

    if (data.texCoords) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(data.texCoords),
        gl.STATIC_DRAW,
      );
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(data.indexList),
      gl.STATIC_DRAW,
    );
    this.count = data.indexList.length;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    if (shProgram.iAttribTexCoord !== -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.iTexBuffer);
      gl.vertexAttribPointer(
        shProgram.iAttribTexCoord,
        2,
        gl.FLOAT,
        false,
        0,
        0,
      );
      gl.enableVertexAttribArray(shProgram.iAttribTexCoord);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  };

  this.DrawWireframe = function () {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndexBuffer);
    for (let i = 0; i < this.count; i += 3) {
      gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
    }
  };
}

// Logic for your Neovius Surface remains largely the same but returns the object
function calculateSurfacePoint(u, v, isUpperHemisphere = true) {
  const cosU = Math.cos(u);
  const cosV = Math.cos(v);
  let zExp = (-3.0 * (cosU + cosV)) / (3.0 + 4.0 * cosU * cosV);
  zExp = Math.max(-1, Math.min(1, zExp));
  let z = Math.acos(zExp);
  if (!isUpperHemisphere) z = -z;
  return { x: u, y: v, z: z };
}

function CreateSurfaceData() {
  const data = { vertexList: [], indexList: [] };
  const steps = 30;
  const range = Math.PI;

  function generate(isUpper) {
    let offset = data.vertexList.length / 3;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        let u = -range + (j / steps) * 2 * range;
        let v = -range + (i / steps) * 2 * range;
        let p = calculateSurfacePoint(u, v, isUpper);
        data.vertexList.push(p.x, p.y, p.z);
      }
    }
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) {
        let r = i * (steps + 1) + j + offset;
        let nr = (i + 1) * (steps + 1) + j + offset;
        data.indexList.push(r, r + 1, nr, nr, r + 1, nr + 1);
      }
    }
  }
  generate(true);
  generate(false);
  return data;
}

function CreateWebcamRectData() {
  return {
    vertexList: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
    texCoords: [0, 1, 1, 1, 1, 0, 0, 0],
    indexList: [0, 1, 2, 0, 2, 3],
  };
}
