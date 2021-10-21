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
}

/**
 * Calculate if ball a and ball b are touching.
 * 
 * @param a:  A ball.
 * @param b:  A second ball.
 * @returns:  True if the balls are touching, false otherwise.
 */
function collision(a, b) {
  let distanceVector = new Vector2D(a.pos.x - b.pos.x, a.pos.y - b.pos.y);

  return distanceVector.length() <= a.radius + b.radius;
}

/**
 * Prevent balls from getting inside each other by increasing the distance
 * between their centers to the sum of their radiuses.
 * 
 * @param a:    Ball a.
 * @param b:    Ball b.
 */
function staticCollide(a, b) {
  let distanceVector = new Vector2D(a.pos.x - b.pos.x, a.pos.y - b.pos.y);

  let theta = Math.atan2(distanceVector.y, distanceVector.x);
  let dist = distanceVector.length();
  let overlap = a.radius + b.radius - dist;

  a.pos.x += overlap / 1.99 * Math.cos(theta);
  a.pos.y += overlap / 1.99 * Math.sin(theta);
  b.pos.x -= overlap / 1.99 * Math.cos(theta);
  b.pos.y -= overlap / 1.99 * Math.sin(theta);
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

  let distanceVector = new Vector2D(b.pos.x - a.pos.x, b.pos.y - a.pos.y);
  let normal = distanceVector.normalized();
  let tangent = new Vector2D(-normal.y, normal.x);

  let scalarNormalA = normal.dot(a.velocity);
  let scalarNormalB = normal.dot(b.velocity);
  let scalarTangentA = tangent.dot(a.velocity);
  let scalarTangentB = tangent.dot(b.velocity);

  let scalarNormalANew = (scalarNormalA * (a.mass - b.mass) + 2 * b.mass * scalarNormalB) / (a.mass + b.mass);
  let scalarNormalBNew = (scalarNormalB * (b.mass - a.mass) + 2 * a.mass * scalarNormalA) / (a.mass + b.mass);

  a.velocity.x = normal.x * scalarNormalANew + tangent.x * scalarTangentA;
  a.velocity.y = normal.y * scalarNormalANew + tangent.y * scalarTangentA;
  b.velocity.x = normal.x * scalarNormalBNew + tangent.x * scalarTangentB;
  b.velocity.y = normal.y * scalarNormalBNew + tangent.y * scalarTangentB;

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
    /* Edit vX and vY so that the length of vector [vX, vY] is equal to this.speed. */
    this.resetSpeed();
    this.playSound();
  }

  /**
   * Edit the ball's velocity so the size of the velocity vector equals the speed:
   * vecLen([vX, vY]) == speed.
   */
  resetSpeed() {
    this.velocity = this.velocity.normalized().multiply(this.speed);
  }

  /**
   * For each other ball, calculate its gravitational force on this ball.
   * Use the total gravitational force to accellerate this ball.
   */
  gravitate() {
    // Gravitational force in both directions.
    let fg = new Vector2D(0, 0);

    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      
      // Prevent this ball from attracting itself.
      if (ball.id == this.id) {
        continue;
      }

      let distanceVector = new Vector2D(this.pos.x - ball.pos.x, this.pos.y - ball.pos.y);
      let distance = distanceVector.length();
      let gForceStrength = g / distance ** 2;  // Total gravitational force.
      let theta = atan2(distanceVector.y, distanceVector.x);  // Angle of horizontal line and line between balls.

      fg.x -= gForceStrength * cos(theta);
      fg.y -= gForceStrength * sin(theta);
    }

    // F = m * a
    this.velocity.x += fg.x / this.mass;
    this.velocity.y += fg.y / this.mass;
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
    let prevPos = new Vector2D(this.pos.x, this.pos.y);
    this.pos.x += this.velocity.x;
    this.pos.y += this.velocity.y;

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
        this.gravitate();
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