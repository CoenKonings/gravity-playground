/**
 * Author:            Coen Konings
 * Date:              30-09-2021
 *
 * Most recent edit:  19-10-2021
 * By:                Coen Konings
 */

let balls = [];  // Array to store all bouncing balls.
let notes = [0, 3, 7, 10, 12];  // Root, minor third, perfect fifth, minor seventh, octave.
let colors = ["#02040F", "#E59500", "#002642", "#E5DADA"];  // Color scheme used for the balls.
let gravity = false;  // Boolean used to turn gravity on or off.
let gravityStrength = 0.5;  // Accelleration by planet mode gravity in pixels / (refresh rate) ** 2
let strokeSize = 5;  // Size of the balls' border.
let gravityMode = "1";  // Are we on earth or in space?
let g = 400;  // The gravitational constant
let drag = 0.025;  // Add some drag so the gravitational accelleration is not infinite.
let dragFactor = 0.05;  // The factor by which to multiply the drag in gravity mode 2 ("space")
let ballDensity = 3;
let leaveTrails = false;
let colorSwap = false;
let soundOn = false;

class Vector2D {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Calculate the length of this vector.
   *
   * @returns The length of the vector.
   */
  length() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  /**
   * Find the normalized vector in the same direction as this vector.
   *
   * @returns A normalized vector.
   */
  normalized() {
    let n = new Vector2D(this.x, this.y);
    n.x = n.x / this.length();
    n.y = n.y / this.length();
    return n;
  }

  /**
   * Calculate the dot product between this vector and another vector.
   *
   * @param v The other vector.
   * @returns The dot product between this and v.
   */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  /**
   * Multiply a vector by a scalar.
   *
   * @param n The number by which to multiply this vector.
   * @returns This vector multiplied by the given scalar.
   */
  multiply(n) {
    return new Vector2D(this.x * n, this.y * n);
  }

  distance(v) {
    return new Vector2D(this.x - v.x, this.y - v.y).length();
  }
}

/**
 * A representation of a ball.
 */
class Ball {
  constructor(id, xPos, yPos, vX, vY, speed, radius, strokeColor, fillColor, note) {
    this.id = id;  // ID to keep track of which ball is which.
    this.pos = new Vector2D(xPos, yPos);
    this.velocity = new Vector2D(vX, vY);
    this.speed = speed;  // The initial speed of the ball.
    this.radius = radius;
    this.mass = 4 / 3 * Math.PI * this.radius ** 3 * ballDensity / 150000 + 1;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.note = note;  // The note the ball should play when it hits something.
    /* Array used to track with which balls this ball has already collided during the current simulation step. */
    this.collided = [];
    this.fg = new Vector2D(0, 0);  // Used to track current gravitational pull on this ball.
    /* Edit vX and vY so that the length of vector [vX, vY] is equal to this.speed. */
    this.resetSpeed();
    this.playSound();
    this.filter = new p5.LowPass();
    this.osc = new p5.Oscillator();
    this.osc.setType('sawtooth');
    this.osc.freq(midiToFreq(this.note));
    this.osc.disconnect();
    this.osc.connect(this.filter);
    this.osc.amp(0);
    console.log("DEBUG -- ", this.note, midiToFreq(this.note));
    this.filter.freq(this.osc.getFreq() * 2);
    this.osc.start();
    this.filterRange = this.radius * 10;
  }

  /**
   * Calculate if ball a and ball b are touching.
   *
   * @param ball  The ball to check for collisions with.
   * @returns:    True if the balls are touching, false otherwise.
   */
  collision(ball) {
    let distanceVector = new Vector2D(this.pos.x - ball.pos.x, this.pos.y - ball.pos.y);
    return distanceVector.length() <= this.radius + ball.radius;
  }

  /**
   * Change direction of movement of this ball and the given ball, based on their angle of collision.
   *
   * @param ball  The ball to collide this with.
   */
  collide(ball) {
    this.staticCollide(ball);

    let distanceVector = new Vector2D(ball.pos.x - this.pos.x, ball.pos.y - this.pos.y);
    let normal = distanceVector.normalized();
    let tangent = new Vector2D(-normal.y, normal.x);

    let scalarNormalA = normal.dot(this.velocity);
    let scalarNormalB = normal.dot(ball.velocity);
    let scalarTangentA = tangent.dot(this.velocity);
    let scalarTangentB = tangent.dot(ball.velocity);

    let scalarNormalANew = (scalarNormalA * (this.mass - ball.mass) + 2 * ball.mass * scalarNormalB) / (this.mass + ball.mass);
    let scalarNormalBNew = (scalarNormalB * (ball.mass - this.mass) + 2 * this.mass * scalarNormalA) / (this.mass + ball.mass);

    this.velocity.x = normal.x * scalarNormalANew + tangent.x * scalarTangentA;
    this.velocity.y = normal.y * scalarNormalANew + tangent.y * scalarTangentA;
    ball.velocity.x = normal.x * scalarNormalBNew + tangent.x * scalarTangentB;
    ball.velocity.y = normal.y * scalarNormalBNew + tangent.y * scalarTangentB;

    this.swapColors();
    this.playSound();
    ball.swapColors();
    ball.playSound();
  }

  /**
   * Prevent balls from getting inside each other by increasing the distance
   * between their centers to the sum of their radiuses.
   *
   * @param ball The ball this collides with.
   */
  staticCollide(ball) {
    let distanceVector = new Vector2D(this.pos.x - ball.pos.x, this.pos.y - ball.pos.y);

    let theta = Math.atan2(distanceVector.y, distanceVector.x);
    let dist = distanceVector.length();
    let overlap = this.radius + ball.radius - dist;

    this.pos.x += overlap / 2 * Math.cos(theta);
    this.pos.y += overlap / 2 * Math.sin(theta);
    ball.pos.x -= overlap / 2 * Math.cos(theta);
    ball.pos.y -= overlap / 2 * Math.sin(theta);
  }

  /**
   * Edit the ball's velocity so the size of the velocity vector equals the speed.
   */
  resetSpeed() {
    this.velocity = this.velocity.normalized().multiply(this.speed);
  }

  /**
   * For each other ball, calculate the gravitational pull of a ball on this.
   *
   * @param ball The ball of which to calculate the gravitational force.
   */
  gravitate(ball) {
    let distanceVector = new Vector2D(this.pos.x - ball.pos.x, this.pos.y - ball.pos.y);
    let distance = distanceVector.length();
    let gForceStrength = g * this.mass * ball.mass / distance ** 2;  // Total gravitational force.
    let theta = atan2(distanceVector.y, distanceVector.x);  // Angle of horizontal line and line between balls.

    this.fg.x -= gForceStrength * cos(theta);
    this.fg.y -= gForceStrength * sin(theta);
  }

  /**
   * Perform a simulation step for this ball, changing its position,
   * velocity and color as needed.
   */
  step() {
    /**
     * Iterate through all balls for collision detection,
     * gravitational pull (if turned on) and average distance.
     */
    let maxDistance = new Vector2D(0, 0).distance(new Vector2D(width, height));
    maxDistance -= this.radius;
    let avgDistance = 0;
    let avgDistanceInRange = 0;
    let closeBalls = 0;
    let closest = this.filterRange;

    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];

      // Prevent balls from colliding with themselves.
      if (ball.id == this.id) {
        continue;
      }

      const distance = this.pos.distance(ball.pos) - ball.radius;

      if (distance < this.filterRange) {
        avgDistanceInRange += distance;
        closeBalls++;
      }

      closest = distance < closest - ball.radius ? distance : closest - ball.radius;

      avgDistance += distance;

      // Detect collision
      if (this.collision(ball) && !this.collided.includes(ball.id)) {
        this.collide(ball);

        // Track which balls have already collided.
        this.collided.push(ball.id);
        ball.collided.push(this.id);
      }

      if (gravity && gravityMode == "2") {
        this.gravitate(ball);
      }
    }

    avgDistanceInRange /= closeBalls;
    avgDistance /= balls.length;
    avgDistanceInRange -= this.radius;
    avgDistance -= this.radius;
    closest -= this.radius;

    let maxFilterDistance = this.filterRange;

    let filterFreq = map(1 - closest / maxFilterDistance, 0, 1, this.osc.getFreq() * 2, 1000 + this.osc.getFreq() * 2);
    let amplitude = map(maxDistance / avgDistance, 0, maxDistance, 0.2, 1, true);
    let panning = map(this.pos.x, 0 + this.radius, width - this.radius, -0.7, 0.7);

    amplitude = balls.length > 1 ? amplitude : 0;
    filterFreq = closeBalls > 0 ? filterFreq : this.osc.getFreq();

    this.osc.amp(amplitude, 1 / 60);
    this.osc.pan(panning);
    this.filter.freq(filterFreq);

    // Move the ball by its velocity.
    let prevPos = new Vector2D(this.pos.x, this.pos.y);

    // Prevent the ball from moving too fast for solid trails to render.
    if (leaveTrails && this.velocity.length() > strokeSize * 0.9) {
      let tempVelocity = this.velocity.normalized().multiply(strokeSize * 0.9);
      this.pos.x += tempVelocity.x;
      this.pos.y += tempVelocity.y;
    } else {
      this.pos.x += this.velocity.x;
      this.pos.y += this.velocity.y;
    }


    // If gravity is turned on, accellerate the ball in the right direction.
    if (gravity) {
      if (gravityMode == "1") {
        // Add some drag to make the bouncing stop sometime.
        if (this.pos.y < height - this.radius - 2) {
          this.velocity.y += gravityStrength;
          this.velocity.y -= (this.velocity.y * drag);
        }

        this.velocity.x -= (this.velocity.x * drag);

      } else if (gravityMode == "2") {
        this.velocity.x += this.fg.x / this.mass;
        this.velocity.y += this.fg.y / this.mass;
        this.velocity.y -= (this.velocity.y * drag * dragFactor);
        this.velocity.x -= (this.velocity.x * drag * dragFactor);
      }
    }

    // Change direction of movement if the ball hits the edge of the canvas.
    if (this.pos.x - this.radius < 0 && this.velocity.x < 0 || this.pos.x + this.radius > width && this.velocity.x > 0) {
      this.velocity.x *= -1;
      this.swapColors();
      this.playSound();
    } else if (this.pos.y - this.radius < 0 && this.velocity.y < 0 || this.pos.y + this.radius > height && this.velocity.y > 0) {
      this.velocity.y *= -1;
      this.swapColors();
      this.playSound();

      /**
       * Prevent balls from indefinitely playing sounds, changing colors and bouncing
       * if gravity is turned on and they're "lying on the floor".
       */
      if (gravity && this.velocity.y <= 0 && this.velocity.y > -2 && gravityMode == "1") {
        this.velocity.y = 0;
        this.pos.y = height - this.radius - 1;
      }
    }

    // Play a sound each time a ball crosses the horizontal or vertical center of the canvas.
    if (this.pos.x >= width/2 && prevPos.x < width/2 || this.pos.x <= width/2 && prevPos.x > width/2) {
      this.playSound();
    }

    if (this.pos.y >= height/2 && prevPos.y < height/2 || this.pos.y <= height/2 && prevPos.y > height/2) {
      this.playSound();
    }

    this.fg.x = 0;
    this.fg.y = 0;
    this.draw();
  }

  /**
   * Draw the ball at its current position.
   */
  draw() {
    stroke(this.strokeColor);
    fill(this.fillColor);
    circle(this.pos.x, this.pos.y, this.radius * 2);
  }

  /**
   * Swap the inner (fill) and outer (stroke) color of the ball.
   */
  swapColors() {
    if (colorSwap) {
      let temp = this.strokeColor;
      this.strokeColor = this.fillColor;
      this.fillColor = temp;
    }
  }

  /**
   * Play a sound.
   *
   * NOTE:
   * The sound module crashes the simulation if too many sounds are played at once.
   * Remove for stability, or if not using the HKU CSD framework.
   */
  playSound() {
    if (soundOn) {
      makeNote(this.note, 1, 5.0);
    }
  }
}

/**
 * Initialize canvas, fill background, draw lines through the horizontal and vertical
 * centers.
 */
function setup() {
  createCanvas(windowWidth - 0.01 * windowWidth, windowHeight - 0.01 * windowHeight);
  strokeWeight(1);
  background(132, 0, 50);
  line(width/2, 0, width/2, height);
  line(0, height/2, width, height/2);
}

/**
 * Write gravity mode and status on the screen.
 */
function showGravityStatus() {
  let g = "Gravity: ";
  g += gravity ? "on" : "off";
  g += "\nGravity mode: ";

  if (gravityMode == "1") {
    g += "planet";
  } else if (gravityMode == "2") {
    g += "space";
  }

  textSize(20);
  text(g, 10, 30);
}

/**
 * The main loop. Is called once every simulation step.
 */
function draw() {
  if (!leaveTrails) {
    // Fill background, draw lines through horizontal and vertical center.
    strokeWeight(1);
    background(132, 0, 50, 180);
    stroke(0);
    fill(0);
    line(width/2, 0, width/2, height);
    line(0, height/2, width, height/2);
    showGravityStatus();
  }

  strokeWeight(strokeSize);

  // For each ball, execute a simulation step.
  for (let i = 0; i < balls.length; i++) {
    balls[i].step();
  }

  // Reset the collision tracking arrays.
  for (let i = 0; i < balls.length; i++) {
    balls[i].collided = [];
  }
}

/**
 * Creates a new random ball at the position of the cursor.
 */
function mouseClicked() {
  let speed = Math.random() * 2 + 1;
  let vX = Math.random() * 2 - 1;
  let vY = Math.random() * 2 - 1;
  let radius = Math.floor(Math.random() * 20) + 10;
  // Smaller balls play higher notes.
  let note = Math.floor((radius - 30) * -1 / 20 * notes.length);
  console.log("DEBUG -- ", note);
  note = notes[note] + 50;
  let id = balls.length;
  let strokeColor = "";
  let fillColor = "";

  // Select two random non equal colors for stroke color and fill color.
  while (strokeColor == fillColor) {
    let a = Math.floor(Math.random() * colors.length);
    let b = Math.floor(Math.random() * colors.length);
    strokeColor = colors[a];
    fillColor = colors[b];
  }

  balls.push(new Ball(id, mouseX, mouseY, vX, vY, speed, radius, strokeColor, fillColor, note));
}

/**
 * Handle key presses.
 */
function keyPressed(event) {
  if (event.key == " ") {
    // Spacebar turns on/off gravity.
    gravity = !gravity;
  } else if (event.key == "Enter") {
    // Enter resets the balls' velocity to match their initial speed.
    for (let i = 0; i < balls.length; i++) {
      balls[i].resetSpeed();
    }
  } else if (event.key == "Backspace") {
    // Backspace deletes the newest ball.
    balls.pop();
  } else if (event.key == "Delete") {
    // Delete removes all balls.
    balls = [];
  } else if (event.key == "1" || event.key == "2") {
    gravityMode = event.key;
  } else if (event.key == "t") {
    leaveTrails = !leaveTrails;
  } else if (event.key == "c") {
    colorSwap = !colorSwap;
  } else if (event.key == "s") {
    soundOn = !soundOn;
  }
}
