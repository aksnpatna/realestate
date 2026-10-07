const http = require('http');

http.get('http://localhost:8100/api/suburbs/point-cook-vic-3030/sqm', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    const sqmData = json.data;
    
    const chartData = [];

    // Process all available data types
    const dataTypes = [
      { key: 'vacancy', dateFields: ['year', 'month'], process: (d) => ({ vacancyRate: parseFloat(d.vr) * 100 }) },
      { key: 'stock', dateFields: ['year', 'month'], process: (d) => {
        let total = parseInt(d.total, 10);
        if (isNaN(total)) {
          total = (parseInt(d.r30, 10) || 0) + (parseInt(d.r60, 10) || 0) + (parseInt(d.r90, 10) || 0) + (parseInt(d.r180, 10) || 0) + (parseInt(d.r180p, 10) || 0);
        }
        return { stock: total > 0 ? total : null };
      } },
      { key: 'rents', dateFields: ['date'], process: (d) => ({
        houseRent: d.houses_all != null && d.houses_all !== "" ? parseFloat(d.houses_all) : null,
        unitRent: d.units_all != null && d.units_all !== "" ? parseFloat(d.units_all) : null
      }) },
      { key: 'prices', dateFields: ['date'], process: (d) => ({
        housePrice: d.houses_all != null && d.houses_all !== "" ? (parseFloat(d.houses_all) < 10000 && parseFloat(d.houses_all) > 0 ? parseFloat(d.houses_all) * 1000 : parseFloat(d.houses_all)) : null,
        unitPrice: d.units_all != null && d.units_all !== "" ? (parseFloat(d.units_all) < 10000 && parseFloat(d.units_all) > 0 ? parseFloat(d.units_all) * 1000 : parseFloat(d.units_all)) : null
      }) }
    ];

    dataTypes.forEach(({ key, dateFields, process }) => {
      const dataset = sqmData[key];
      if (!dataset || !Array.isArray(dataset) || dataset.length === 0) return;

      dataset.forEach((item) => {
        let date;
        let dateStr;
        let displayDate;

        if (dateFields.includes('year') && dateFields.includes('month')) {
          date = new Date(item.year, item.month - 1);
          dateStr = `${item.year}-${String(item.month).padStart(2, '0')}`;
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          displayDate = `${monthNames[item.month - 1]} ${item.year}`;
        } else if (dateFields.includes('date')) {
          const parts = item.date.split('-');
          if (parts.length >= 2) {
            dateStr = `${parts[0]}-${parts[1]}`;
            date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            displayDate = `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
          } else {
            return;
          }
        } else {
          return;
        }

        const existing = chartData.find(d => d.dateStr === dateStr);
        const processed = process(item);
        
        if (existing) {
          Object.assign(existing, processed);
        } else {
          chartData.push({
            date: date.getTime(),
            dateStr,
            displayDate,
            vacancyRate: null,
            stock: null,
            houseRent: null,
            unitRent: null,
            housePrice: null,
            unitPrice: null,
            ...processed
          });
        }
      });
    });

    chartData.sort((a, b) => a.date - b.date);
    
    // Print the last 5 entries to see if houseRent is populated
    console.log("LAST 5 CHART DATA ENTRIES:");
    console.log(JSON.stringify(chartData.slice(-5), null, 2));

  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
