const fs = require('fs');
const sqmData = JSON.parse(fs.readFileSync('test_data.json', 'utf8'));

let chartData = [];
if (!sqmData || !sqmData.vacancy) {
    console.log("No vacancy data");
    process.exit(1);
}

const data = sqmData.vacancy.map((v) => {
    const date = new Date(v.year, v.month - 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
    date: date.getTime(),
    dateStr: `${v.year}-${String(v.month).padStart(2, '0')}`,
    displayDate: `${monthNames[v.month - 1]} ${v.year}`,
    vacancyRate: parseFloat(v.vr) * 100, // Convert to percentage
    };
});

if (sqmData.stock) {
    sqmData.stock.forEach((s) => {
    const dateStr = `${s.year}-${String(s.month).padStart(2, '0')}`;
    const existing = data.find((d) => d.dateStr === dateStr);
    const totalStock = (parseInt(s.r30) || 0) + (parseInt(s.r60) || 0) + (parseInt(s.r90) || 0) + (parseInt(s.r180) || 0) + (parseInt(s.r180p) || 0);
    if (existing) {
        existing.stock = totalStock;
    } else {
        const date = new Date(s.year, s.month - 1);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        data.push({
        date: date.getTime(),
        dateStr,
        displayDate: `${monthNames[s.month - 1]} ${s.year}`,
        stock: totalStock,
        });
    }
    });
}
data.sort((a, b) => a.date - b.date);
chartData = data;

if (chartData.length < 12) {
    console.log("chartData length < 12");
}

const current = chartData[chartData.length - 1];
const yearAgo = chartData[chartData.length - 13];

console.log("Current:", current);
console.log("YearAgo:", yearAgo);

if (!current || !yearAgo || current.vacancyRate == null || yearAgo.vacancyRate == null) {
    console.log("Returned null because of nulls");
} else {
    console.log("Success! AI Insights generated.");
}
