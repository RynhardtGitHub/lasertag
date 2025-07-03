
const { getClosestColor } = require('./utils');

const target = { r: 120, g: 100, b: 90 };
const list = [
  { r: 255, g: 0, b: 0 },    // red
  { r: 0, g: 255, b: 0 },    // green
  { r: 0, g: 0, b: 255 },    // blue
  { r: 110, g: 105, b: 95 }  // close to target
];

const closest = getClosestColor(target, list);
console.log(closest); // { r: 110, g: 105, b: 95 }
