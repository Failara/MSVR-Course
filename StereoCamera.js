function StereoCamera(
  eyeSeparation,
  convergence,
  aspectRatio,
  fovRadians,
  near,
  far,
) {
  this.eyeSeparation = eyeSeparation;
  this.convergence = convergence;
  this.aspectRatio = aspectRatio;
  this.fov = fovRadians;
  this.near = near;
  this.far = far;

  this.calcFrustum = function (isLeft) {
    let top = this.near * Math.tan(this.fov / 2);
    let bottom = -top;
    let a = this.aspectRatio * Math.tan(this.fov / 2) * this.convergence;

    let offset = (this.eyeSeparation / 2) * (isLeft ? 1 : -1);

    let left = (-(a - offset) * this.near) / this.convergence;
    let right = ((a + offset) * this.near) / this.convergence;

    return m4.frustum(left, right, bottom, top, this.near, this.far);
  };
}
