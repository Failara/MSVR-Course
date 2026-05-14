"use strict";

AFRAME.registerGeometry("neovius", {
  schema: {
    steps: { default: 30 },
    range: { default: Math.PI },
  },

  init: function (data) {
    const vertices = [];
    const indices = [];
    const steps = data.steps;
    const range = data.range;

    function generate(isUpper) {
      const offset = vertices.length / 3;
      for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps; j++) {
          let u = -range + (j / steps) * 2 * range;
          let v = -range + (i / steps) * 2 * range;
          let p = calculateSurfacePoint(u, v, isUpper);
          vertices.push(p.x, p.y, p.z);
        }
      }
      for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
          let r = i * (steps + 1) + j + offset;
          let nr = (i + 1) * (steps + 1) + j + offset;
          indices.push(r, r + 1, nr);
          indices.push(nr, r + 1, nr + 1);
        }
      }
    }

    generate(true);
    generate(false);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    this.geometry = geometry;
  },
});

function calculateSurfacePoint(u, v, isUpperHemisphere = true) {
  const cosU = Math.cos(u);
  const cosV = Math.cos(v);
  let zExp = (-3.0 * (cosU + cosV)) / (3.0 + 4.0 * cosU * cosV);
  zExp = Math.max(-1, Math.min(1, zExp));
  let z = Math.acos(zExp);
  if (!isUpperHemisphere) z = -z;
  return { x: u, y: v, z: z };
}
