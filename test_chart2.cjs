const fs = require('fs');

const sqmData = JSON.parse(fs.readFileSync('test_point_cook.json', 'utf8'));
const vacData = JSON.parse(fs.readFileSync('test_point_cook_vacancy.json', 'utf8'));

const parseDate = (dateStr) => {
  const date = new Date(dateStr);
  return {
    date: date.getTime(),
    dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
    displayDate: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  };
};

const chartData = vacData.vacancy.map(v => {
  const pDate = parseDate(v.date);
  return { ...pDate, vacancyRate: parseFloat(v.vacancy) || null };
});

const processData = (data, config) => {
  data.forEach(d => {
    const pDate = parseDate(d[config.dateFields[0]]);
    const existing = chartData.find(c => c.dateStr === pDate.dateStr);
    if (existing) {
      Object.assign(existing, config.process(d));
    } else {
      chartData.push({ ...pDate, ...config.process(d) });
    }
  });
};

processData(sqmData.rents, {
  dateFields: ['date'],
  process: (d) => ({
    houseRent: parseFloat(d.houses_all) || null,
    unitRent: parseFloat(d.units_all) || null
  })
});

const filtered = chartData.filter(d => d.houseRent != null || d.unitRent != null);
console.log("Total chartData:", chartData.length);
console.log("Total filtered rents:", filtered.length);
if (filtered.length > 0) {
    console.log("First filtered item:", filtered[0]);
}

