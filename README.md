# p5-bouncing-balls

Requires P5 JS to work. Remove the `makenote()` calls when not using HKU's CSDOSC framework.

Controls:
- Left mouse click to create a new ball at the cursor's location
- Spacebar to turn on/off gravity
- 1 and 2 to switch gravity modes
- c to turn color swapping on or off
- t to turn trails on or off
- Enter to reset all balls' speeds
- Backspace to remove the newest ball
- Delete to remove all balls
- s to turn sound on or off

Planned changes:
- Use P5's native vectors
- Have each ball emit a drone, modulating the volume by the average distance to other balls.
