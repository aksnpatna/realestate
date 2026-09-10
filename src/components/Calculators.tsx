import { useState, memo } from 'react';

import { calculateComprehensiveStampDuty } from '../data/suburbs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ROICalculator } from './ROICalculator';

type CalcType = 'repayment' | 'borrowing' | 'stamp_duty' | 'roi';

const STATE_OPTIONS = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

type PropertyType = 'established' | 'new_home' | 'vacant_land';

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function formatCurrency(v: number) {
  return '$' + Math.max(0, Math.round(v)).toLocaleString();
}

export default memo(function Calculators() {
  const [activeCalc, setActiveCalc] = useState<CalcType>('repayment');

  const [loanAmount, setLoanAmount] = useState(400000);
  const [interestRate, setInterestRate] = useState(5.5);
  const [loanTerm, setLoanTerm] = useState(30);

  const [income, setIncome] = useState(120000);
  const [expenses, setExpenses] = useState(30000);

  const [propertyValue, setPropertyValue] = useState(600000);
  const [state, setState] = useState('VIC');
  const [isFirstHome, setIsFirstHome] = useState(false);
  const [propertyType, setPropertyType] = useState<PropertyType>('established');

  const calculateRepayment = () => {
    const r = (interestRate / 100) / 12;
    const n = loanTerm * 12;
    if (r === 0) return loanAmount / n;
    return (loanAmount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  const calculateBorrowing = () => {
    const netIncome = income - expenses;
    const r = (6.5 / 100) / 12;
    const n = 30 * 12;
    const maxPayment = (netIncome * 0.3) / 12;
    return (maxPayment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n));
  };

  const stampDutyResult = calculateComprehensiveStampDuty(propertyValue, state, isFirstHome, propertyType);

  const chartData = activeCalc === 'stamp_duty' ? [
    { name: 'Stamp Duty', value: Math.round(Math.max(0, stampDutyResult.duty)) },
    { name: 'Mortgage Reg', value: Math.round(stampDutyResult.mortgageReg) },
    { name: 'Transfer Fee', value: Math.round(stampDutyResult.transferFee) },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="dashboard-content u-bf9ca78e">
      <div className="header-section u-d5785af4">
        <h2>Financial Calculators</h2>
        <p className="u-c7477801">Plan better with clear insights and reliable numbers for informed property planning.</p>
      </div>

      <div className="u-ecbe3da7">
        <button
          onClick={() => setActiveCalc('repayment')}
          className="u-5faddcca" style={{background: activeCalc === 'repayment' ? 'var(--accent-cyan)' : 'var(--bg-card)', color: activeCalc === 'repayment' ? '#000' : 'var(--text-primary)'}}>Loan Repayment</button>
        <button
          onClick={() => setActiveCalc('borrowing')}
          className="u-5faddcca" style={{background: activeCalc === 'borrowing' ? 'var(--accent-purple)' : 'var(--bg-card)', color: activeCalc === 'borrowing' ? '#fff' : 'var(--text-primary)'}}>Borrowing Power</button>
        <button
          onClick={() => setActiveCalc('stamp_duty')}
          className="u-5faddcca" style={{background: activeCalc === 'stamp_duty' ? 'var(--warning)' : 'var(--bg-card)', color: activeCalc === 'stamp_duty' ? '#000' : 'var(--text-primary)'}}>Stamp Duty & FHOG</button>
        <button
          onClick={() => setActiveCalc('roi')}
          className="u-5faddcca" style={{background: activeCalc === 'roi' ? 'var(--accent-green)' : 'var(--bg-card)', color: activeCalc === 'roi' ? '#000' : 'var(--text-primary)'}}>Investment Calculator</button>
      </div>

      <div className="u-b0a96210">

        {activeCalc === 'repayment' && (
          <div className="u-79bf16b1">
            <div>
              <h3>Loan Details</h3>
              <div className="u-127b72f0">
                <label className="u-359af586">Loan Amount ($)</label>
                <input type="number" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} className="u-ea6906e8" />
              </div>
              <div className="u-127b72f0">
                <label className="u-359af586">Interest Rate (%)</label>
                <input type="number" step="0.1" value={interestRate} onChange={e => setInterestRate(Number(e.target.value))} className="u-ea6906e8" />
              </div>
              <div className="u-127b72f0">
                <label className="u-359af586">Loan Term (Years)</label>
                <input type="number" value={loanTerm} onChange={e => setLoanTerm(Number(e.target.value))} className="u-ea6906e8" />
              </div>
            </div>
            <div className="u-65f56cda">
              <h3 className="u-850c2233">Estimated Monthly Repayment</h3>
              <div className="u-a770908b">
                {formatCurrency(calculateRepayment())}
              </div>
              <p className="u-5c250845">
                Total Interest Payable: {formatCurrency(Math.round(calculateRepayment() * loanTerm * 12) - loanAmount)}
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'borrowing' && (
          <div className="u-79bf16b1">
            <div>
              <h3>Income & Expenses</h3>
              <div className="u-127b72f0">
                <label className="u-359af586">Annual Income ($)</label>
                <input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} className="u-ea6906e8" />
              </div>
              <div className="u-127b72f0">
                <label className="u-359af586">Annual Expenses ($)</label>
                <input type="number" value={expenses} onChange={e => setExpenses(Number(e.target.value))} className="u-ea6906e8" />
              </div>
            </div>
            <div className="u-65f56cda">
              <h3 className="u-850c2233">Estimated Borrowing Power</h3>
              <div className="u-f863562f">
                {formatCurrency(Math.max(0, calculateBorrowing()))}
              </div>
              <p className="u-5c250845">
                Based on a 6.5% stress-test interest rate over 30 years.
              </p>
            </div>
          </div>
        )}

        {activeCalc === 'stamp_duty' && (
          <div>
            <div className="u-79bf16b1">
              <div>
                <h3>Property Details</h3>
                <div className="u-127b72f0">
                  <label className="u-359af586">Value of Property ($)</label>
                  <input type="number" value={propertyValue} onChange={e => setPropertyValue(Number(e.target.value))} className="u-ea6906e8" />
                </div>
                <div className="u-127b72f0">
                  <label className="u-359af586">State</label>
                  <select value={state} onChange={e => setState(e.target.value)} className="u-ea6906e8">
                    {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="u-127b72f0">
                  <label className="u-359af586">Property Type</label>
                  <div className="u-ac734d21">
                    {([['established', 'Established'], ['new_home', 'New Home'], ['vacant_land', 'Vacant Land']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setPropertyType(val as PropertyType)}
                        className="u-09d72e1c" style={{background: propertyType === val ? 'var(--warning)' : 'rgba(0,0,0,0.2)', color: propertyType === val ? '#000' : '#fff'}}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="u-127b72f0">
                  <label className="u-359af586">Are you a First Home Buyer?</label>
                  <div className="u-bccf3703">
                    <button onClick={() => setIsFirstHome(true)} className="u-c3799eb7" style={{background: isFirstHome ? 'var(--warning)' : 'rgba(0,0,0,0.2)', color: isFirstHome ? '#000' : '#fff'}}>Yes</button>
                    <button onClick={() => setIsFirstHome(false)} className="u-c3799eb7" style={{background: !isFirstHome ? 'var(--warning)' : 'rgba(0,0,0,0.2)', color: !isFirstHome ? '#000' : '#fff'}}>No</button>
                  </div>
                </div>
              </div>
              <div className="u-f82c65a7">
                <h3 className="u-d9526865">Government Fees</h3>
                <div className="u-20f7f541">
                  <div className="u-cfd43a34">
                    <span className="u-c7477801">Stamp Duty on Property</span>
                    <span className="u-cf8b7bbd">{formatCurrency(stampDutyResult.duty)}</span>
                  </div>
                  <div className="u-cfd43a34">
                    <span className="u-c7477801">Mortgage Registration</span>
                    <span className="u-c154f6c6">{formatCurrency(stampDutyResult.mortgageReg)}</span>
                  </div>
                  <div className="u-cfd43a34">
                    <span className="u-c7477801">Transfer Fee</span>
                    <span className="u-c154f6c6">{formatCurrency(stampDutyResult.transferFee)}</span>
                  </div>
                  <div className="u-b5dc4301">
                    <span className="u-b29509c8">Total Government Fees</span>
                    <span className="u-129a3ad5">{formatCurrency(stampDutyResult.totalGovtFees)}</span>
                  </div>
                </div>
                <div className="u-645ce92d">
                  <div className="u-69f9d299">
                    <div>
                      <div className="u-4b7090c8">First Home Owner Grant</div>
                      <div className="u-57d45d6e">Government contribution towards your deposit</div>
                    </div>
                    <span className="u-6b44e65f">{formatCurrency(stampDutyResult.fhog)}</span>
                  </div>
                </div>
              </div>
            </div>
            {chartData.length > 0 && (
              <div className="u-7ac6ee99">
                <h4 className="u-65b09a4a">Fee Breakdown</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${formatCurrency(value)}`}>
                      {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="u-6532d914">
              Disclaimer: This is an approximation based on {state} state revenue office rates for 2026-2027. Actual fees may vary. Please consult a professional for accurate figures.
            </p>
          </div>
        )}

        {activeCalc === 'roi' && (
          <ROICalculator />
        )}

      </div>
    </div>
  );
});
