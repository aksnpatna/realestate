const chartData = [
  { date: 1, houseRent: undefined, unitRent: undefined },
  { date: 2, houseRent: null, unitRent: null },
  { date: 3, houseRent: 322.5, unitRent: 240 }
];
const filtered = chartData.filter(d => d.houseRent != null || d.unitRent != null);
console.log(filtered);
