/**
 * Author:            Coen Konings
 * Date:              30-09-2021
 * 
 * Most recent edit:  19-10-2021
 * By:                Coen Konings
 */

let balls = [];  // Array to store all bouncing balls.
let notes = [0, 3, 7, 10, 12];  // Root, minor third, perfect fifth, minor third, octave.
let colors = ["#02040F", "#E59500", "#002642", "#E5DADA"];  // Color scheme used for the balls.
let gravity = false;  // Boolean used to turn gravity on or off.
let gravityStrength = 0.5;  // Accelleration by gravity in pixels / (refresh rate) ** 2
let strokeSize = 5;  // Size of the balls' border.
let gravityMode = "1";  // Are we on earth or in space?
let g = 1000;  // The gravitational constant
let drag = 0.025;  // Add some drag so the gravitational accelleration is not infinite.
let dragFactor = 0.08;  // The factor by which to multiply the drag in gravity mode 2 ("space")
let ballDensity = 3;

/**
 * Scale a 2D vector so that its length is 1.
 * 
 * @param v:  The vector to normalize.
 * @returns:  The normalized vector.
 */
function normalize(v) {
  lenV = vecLen(v);
  n0 = v[0] / lenV;
  n1 = v[1] / lenV;
  n = [n0, n1];
  return n;
}

/**
 * Calculate dot product of two vectors.
 * 
 * @param a:  One of the vectors.
 * @param b:  The other vector.
 * @returns:  The dot product of a and b.
 */
function dotProd(a, b) {
  let output = 0;

  for (let i = 0; i < a.length; i++) {
    output += a[i] * b[i];
  }

  return output;
}

/**
 * Calculate the length of a vector.
 * 
 * @param v:  The vector of which the length will be calculated.
 * @returns:  The length of v.
 */
function vecLen(v) {
  let output = 0;
  
  for (let i = 0; i < v.length; i++) {
    output += v[i] ** 2;
  }

  return Math.sqrt(output);
}

/**
 * Calculate if ball a and ball b are touching.
 * 
 * @param a:  A ball.
 * @param b:  A second ball.
 * @returns:  True if the balls are touching, false otherwise.
 */
function collision(a, b) {
  let dx = a.xPos - b.xPos;
  let dy = a.yPos - b.yPos;

  if (vecLen([dx, dy]) <= a.radius + b.radius) {
    return true;
  }

  return false;
}

/**
 * Prevent balls from getting inside each other by increasing the distance
 * between their centers to the sum of their radiuses.
 * 
 * @param a:    Ball a.
 * @param b:    Ball b.
 */
function staticCollide(a, b) {
  let dX = a.xPos - b.xPos;
  let dY = a.yPos - b.yPos;

  let theta = Math.atan2(dY, dX);
  let dist = Math.sqrt(dX**2 + dY**2);
  let overlap = a.radius + b.radius - dist;

  a.xPos += overlap / 1.99 * Math.cos(theta);
  a.yPos += overlap / 1.99 * Math.sin(theta);
  b.xPos -= overlap / 1.99 * Math.cos(theta);
  b.yPos -= overlap / 1.99 * Math.sin(theta);
}

/**
 * Change direction of movement of two colliding balls, based
 * on velocity and angle of collision.
 * 
 * @param a:  Ball A.
 * @param b:  Ball B.
 */
function collide(a, b) {
  staticCollide(a, b);

  let dx = b.xPos - a.xPos;
  let dy = b.yPos - a.yPos;
  let n = normalize([dx, dy]);
  let t = [-n[1], n[0]];
  let vA = [a.vX, a.vY];
  let vB = [b.vX, b.vY];

  let nA = dotProd(n, vA);
  let nB = dotProd(n, vB);
  let tA = dotProd(t, vA);
  let tB = dotProd(t, vB);

  let nANew = (nA * (a.mass - b.mass) + 2 * b.mass * nB) / (a.mass + b.mass);
  let nBNew = (nB * (b.mass - a.mass) + 2 * a.mass * nA) / (a.mass + b.mass);

  a.vX = n[0] * nANew + t[0] * tA;
  a.vY = n[1] * nANew + t[1] * tA;
  b.vX = n[0] * nBNew + t[0] * tB;
  b.vY = n[1] * nBNew + t[1] * tB;

  a.swapColors();
  a.playSound();
  b.swapColors();
  b.playSound();
}

/**
 * A representation of a ball.
 */
class Ball {
  constructor(id, xPos, yPos, vX, vY, speed, radius, strokeColor, fillColor, note) {
    this.id = id;  // ID to keep track of which ball is which.
    this.xPos = xPos;
    this.yPos = yPos;
    this.vX = vX;  // The ball's horizontal velocity.
    this.vY = vY;  // The ball's vertical velocity.
    this.speed = speed;  // The initial speed of the ball.
    this.radius = radius;
    this.mass = 4 / 3 * Math.PI * this.radius ** 3 * ballDensity / 150000 + 1;
    this.strokeColor = strokeColor;
    this.fillColor = fillColor;
    this.note = note;  // The note the ball should play when it hits something.
    /* Array used to track with which balls this ball has already collided during the current simulation step. */
    this.collided = [];
    /* Edit vX and vY so that the length of vector [vX, vY] is equal to this.speed. */
    this.resetSpeed();
    this.playSound();
  }

  /**
   * Edit the ball's velocity so the size of the velocity vector equals the speed:
   * vecLen([vX, vY]) == speed.
   */
  resetSpeed() {
    let newSpeed = normalize([this.vX, this.vY]);
    this.vX = newSpeed[0] * this.speed;
    this.vY = newSpeed[1] * this.speed;
  }

  /**
   * For each other ball, calculate its gravitational force on this ball.
   * Use the total gravitational force to accellerate this ball.
   */
  gravitate() {
    // Gravitational force in both directions.
    let fgx = 0;
    let fgy = 0;

    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      
      // Prevent this ball from attracting itself.
      if (ball.id == this.id) {
        continue;
      }

      let dx = this.xPos - ball.xPos;
      let dy = this.yPos - ball.yPos;
      let dist = vecLen([dx, dy]);
      let fg = g / dist ** 2;  // Total gravitational force.
      let theta = atan2(dy, dx);  // Angle of horizontal line and line between balls.

      fgx -= fg * cos(theta);
      fgy -= fg * sin(theta);

      if (fgx > 0.1 || fgy > 0.1) {
        console.log("--------------");
        console.log(fgx, fgy);
        console.log(dx, dy);
      }
    }

    // F = m * a
    this.vX += fgx / this.mass;
    this.vY += fgy / this.mass;
  }
  
  /**
   * Perform a simulation step for this ball, changing its position,
   * velocity and color as needed.
   */
  step() {
    
    // Iterate through all balls to check if they're colliding with this ball.
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      
      // Prevent balls from colliding with themselves.
      if (ball.id == this.id) {
        continue;
      }
      
      // Detect collision
      if (collision(this, ball) && !this.collided.includes(ball.id)) {
        collide(this, ball);

        // Track which balls have already collided.
        this.collided.push(ball.id);
        ball.collided.push(this.id);
      }
    }
    
    // Move the ball by its velocity.
    let prevXPos = this.xPos;
    let prevYPos = this.yPos;
    this.xPos += this.vX;
    this.yPos += this.vY;

    // If gravity is turned on, accellerate the ball in the right direction.
    if (gravity) {
      if (gravityMode == "1") {
        // Add some drag to make the bouncing stop sometime.
        if (this.yPos < height - this.radius - 2) {
          this.vY += gravityStrength;
          this.vY -= (this.vY * drag);
        }

        this.vX -= (this.vX * drag);
      } else if (gravityMode == "2") {
        this.gravitate();
        this.vY -= (this.vY * drag * dragFactor);
        this.vX -= (this.vX * drag * dragFactor);
      }

    }
    
    // Change direction of movement if the ball hits the edge of the canvas.
    if (this.xPos - this.radius < 0 && this.vX < 0 || this.xPos + this.radius > width && this.vX > 0) {
      this.vX *= -1;
      this.swapColors();
      this.playSound();
    } else if (this.yPos - this.radius < 0 && this.vY < 0 || this.yPos + this.radius > height && this.vY > 0) {
      this.vY *= -1;
      this.swapColors();
      this.playSound();

      /**
       * Prevent balls from indefinitely playing sounds, changing colors and bouncing
       * if gravity is turned on and they're "lying on the floor".
       */
      if (gravity && this.vY <= 0 && this.vY > -2 && gravityMode == "1") {
        this.vY = 0;
        this.yPos = height - this.radius - 1;
      }
    }

    // Play a sound each time a ball crosses the horizontal or vertical center of the canvas.
    if (this.xPos >= width/2 && prevXPos < width/2 || this.xPos <= width/2 && prevXPos > width/2) {
      this.playSound();
    }
    
    if (this.yPos >= height/2 && prevYPos < height/2 || this.yPos <= height/2 && prevYPos > height/2) {
      this.playSound();
    }

    this.draw();
  }

  /**
   * Draw the ball at its current position.
   */
  draw() {
    stroke(this.strokeColor);
    fill(this.fillColor);
    circle(this.xPos, this.yPos, this.radius * 2);
  }

  /**
   * Swap the inner (fill) and outer (stroke) color of the ball.
   */
  swapColors() {
    let temp = this.strokeColor;
    this.strokeColor = this.fillColor;
    this.fillColor = temp;
  }
  
  /**
   * Play a sound.
   * 
   * NOTE:
   * The sound module crashes the simulation if too many sounds are played at once.
   * Remove for stability, or if not using the HKU CSD framework.
   */
  playSound() {
    // makeNote(this.note, 1, 5.0);
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
 * The main loop. Is called once every simulation step.
 */
function draw() {
  // Fill background, draw lines through horizontal and vertical center.
  strokeWeight(1);
  // background(132, 0, 50, 180);
  stroke(0);
  fill(0);
  line(width/2, 0, width/2, height);
  line(0, height/2, width, height/2);
  // Show current gravity mode in top left corner.
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
  }
}