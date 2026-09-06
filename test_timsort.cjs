const arr = [];
for (let i = 0; i < 259; i++) arr.push({ date: NaN, val: 1 });
for (let i = 0; i < 206; i++) arr.push({ date: 206 - i, val: 2 });
arr.sort((a, b) => a.date - b.date);
const valid = arr.filter(d => !isNaN(d.date));
console.log("Total:", arr.length);
console.log("Valid:", valid.length);
if (valid.length > 0) {
  console.log("First valid:", valid[0]);
  console.log("Last valid:", valid[valid.length - 1]);
}
