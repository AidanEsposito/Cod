let a = prompt("Write first variable here: ");
let b = prompt("Write second variable here: ");

let temp;

temp = a;
a = b;
b = temp;

console.log("Value A is now: " + a);
console.log("Value B is now : " + b);
