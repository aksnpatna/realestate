import React, { useState } from 'react';
import './ChartToggle.css';

interface ChartToggleProps {
  id?: string;
  title: string;
  chart: React.ReactNode;
  data: { label: string; value: string | number }[];
  colHeaders?: [string, string];
}

export const ChartToggle: React.FC<ChartToggleProps> = ({
  id, title, chart, data, colHeaders = ['Category', 'Value'],
}) => {
  const [showTable, setShowTable] = useState(false);
  const datasetId = id || title.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="ct" id={datasetId}>
      <div className="ct__header">
        <h4 className="ct__title">{title}</h4>
        <button
          className="ct__toggle"
          onClick={() => setShowTable(!showTable)}
          aria-expanded={showTable}
          aria-controls={`${datasetId}-table`}
        >
          {showTable ? 'View chart' : 'View as table'}
        </button>
      </div>
      {showTable ? (
        <table id={`${datasetId}-table`} className="ct__table">
          <thead>
            <tr>
              <th>{colHeaders[0]}</th>
              <th>{colHeaders[1]}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <td>{d.label}</td>
                <td>{typeof d.value === 'number' ? d.value.toLocaleString() : d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="ct__chart">{chart}</div>
      )}
    </div>
  );
};
