from pydantic import BaseModel, Field
from fastapi import APIRouter
from typing import Literal

router = APIRouter(prefix="/api/calculators", tags=["Calculators"])


FHOG = {
    "NSW": {"established": 0, "new_home": 10000, "vacant_land": 0, "cap_new": 750000, "cap_established": 0},
    "VIC": {"established": 0, "new_home": 10000, "vacant_land": 0, "cap_new": 750000, "cap_established": 0},
    "QLD": {"established": 0, "new_home": 30000, "vacant_land": 0, "cap_new": 750000, "cap_established": 0},
    "WA": {"established": 0, "new_home": 10000, "vacant_land": 0, "cap_new": 750000, "cap_established": 0},
    "SA": {"established": 0, "new_home": 15000, "vacant_land": 0, "cap_new": 650000, "cap_established": 0},
    "TAS": {"established": 0, "new_home": 30000, "vacant_land": 0, "cap_new": 0, "cap_established": 0},
    "ACT": {"established": 0, "new_home": 0, "vacant_land": 0, "cap_new": 0, "cap_established": 0},
    "NT": {"established": 0, "new_home": 10000, "vacant_land": 0, "cap_new": 750000, "cap_established": 0},
}

FIRST_HOME_CONCESSION = {
    "NSW": {"fullExemption": 1000000, "concessionalRange": [1000000, 1200000], "concessionalDutyReduction": 0.5},
    "VIC": {"fullExemption": 600000, "concessionalRange": [600000, 750000], "concessionalDutyReduction": 0.5},
    "QLD": {"fullExemption": 700000, "concessionalRange": [700000, 800000], "concessionalDutyReduction": 0.5},
    "WA": {"fullExemption": 430000, "concessionalRange": [430000, 530000], "concessionalDutyReduction": 0.5},
    "SA": {"fullExemption": 650000, "concessionalRange": [650000, 700000], "concessionalDutyReduction": 0.5},
    "TAS": {"fullExemption": 0, "concessionalRange": [0, 600000], "concessionalDutyReduction": 0.5},
    "ACT": {"fullExemption": 0, "concessionalRange": [0, 1000000], "concessionalDutyReduction": 0},
    "NT": {"fullExemption": 0, "concessionalRange": [0, 650000], "concessionalDutyReduction": 0.5},
}

GOVT_FEES = {
    "NSW": {"mortgageReg": 164.90, "transferFee": 151.60},
    "VIC": {"mortgageReg": 121.40, "transferFee": 96.30},
    "QLD": {"mortgageReg": 196.00, "transferFee": 192.70},
    "WA": {"mortgageReg": 181.10, "transferFee": 211.50},
    "SA": {"mortgageReg": 176.00, "transferFee": 195.00},
    "TAS": {"mortgageReg": 141.00, "transferFee": 192.70},
    "ACT": {"mortgageReg": 174.00, "transferFee": 410.00},
    "NT": {"mortgageReg": 168.00, "transferFee": 147.00},
}


def _calculate_stamp_duty_raw(price: float, state: str) -> float:
    s = state.upper()
    if s == "NSW":
        if price <= 14500: return price * 0.0125
        if price <= 30000: return 175 + (price - 14500) * 0.015
        if price <= 80000: return 415 + (price - 30000) * 0.0175
        if price <= 300000: return 1290 + (price - 80000) * 0.035
        if price <= 1000000: return 8990 + (price - 300000) * 0.045
        if price <= 3000000: return 40490 + (price - 1000000) * 0.055
        return 150490 + (price - 3000000) * 0.07
    if s == "VIC":
        if price <= 25000: return price * 0.014
        if price <= 130000: return 350 + (price - 25000) * 0.024
        if price <= 960000: return 2870 + (price - 130000) * 0.06
        return 2870 + 830000 * 0.06 + (price - 960000) * 0.055
    if s == "QLD":
        if price <= 5000: return 0
        if price <= 75000: return (price - 5000) * 0.015
        if price <= 540000: return 1050 + (price - 75000) * 0.035
        if price <= 1000000: return 17325 + (price - 540000) * 0.045
        return 38025 + (price - 1000000) * 0.0575
    if s == "WA":
        if price <= 120000: return price * 0.019
        if price <= 150000: return 2280 + (price - 120000) * 0.0285
        if price <= 360000: return 3135 + (price - 150000) * 0.038
        if price <= 725000: return 11115 + (price - 360000) * 0.0475
        return 28435 + (price - 725000) * 0.0515
    if s == "SA":
        if price <= 12000: return price * 0.01
        if price <= 30000: return 120 + (price - 12000) * 0.02
        if price <= 50000: return 480 + (price - 30000) * 0.03
        if price <= 100000: return 1080 + (price - 50000) * 0.035
        if price <= 200000: return 2830 + (price - 100000) * 0.04
        if price <= 250000: return 6830 + (price - 200000) * 0.0425
        if price <= 300000: return 8955 + (price - 250000) * 0.0475
        if price <= 500000: return 11330 + (price - 300000) * 0.05
        return 21330 + (price - 500000) * 0.055
    if s == "TAS":
        if price <= 3000: return 50
        if price <= 25000: return 50 + (price - 3000) * 0.0175
        if price <= 75000: return 435 + (price - 25000) * 0.0225
        if price <= 200000: return 1560 + (price - 75000) * 0.035
        if price <= 375000: return 5935 + (price - 200000) * 0.04
        if price <= 725000: return 12935 + (price - 375000) * 0.0425
        return 27810 + (price - 725000) * 0.045
    if s == "ACT":
        if price <= 200000: return max(price * 0.012, 20)
        if price <= 300000: return 2400 + (price - 200000) * 0.034
        if price <= 500000: return 5800 + (price - 300000) * 0.043
        if price <= 750000: return 14400 + (price - 500000) * 0.052
        if price <= 1000000: return 27400 + (price - 750000) * 0.06
        return 42400 + (price - 1000000) * 0.0675
    if s == "NT":
        return (price / 525000) * price * 0.0545 if price <= 525000 else 525000 * 0.0545
    return 0


def _calc_transfer_fee(price: float, state: str) -> float:
    s = state.upper()
    if s == "NSW":
        if price <= 100000: return 100
        if price <= 200000: return 200
        if price <= 300000: return 300
        if price <= 500000: return 400
        if price <= 1000000: return 500
        if price <= 2000000: return 600
        if price <= 3000000: return 700
        return 800
    if s == "VIC":
        if price <= 10000: return 0
        if price <= 50000: return 10
        if price <= 100000: return 100
        if price <= 250000: return 250
        if price <= 500000: return 500
        if price <= 1000000: return 1000
        if price <= 2000000: return 2000
        return 3000
    if s == "QLD":
        if price <= 180000: return 192.70
        if price <= 350000: return 384.50
        if price <= 550000: return 577.00
        if price <= 1000000: return 770.00
        return 962.50
    if s == "WA":
        if price <= 100000: return 100
        if price <= 200000: return 200
        if price <= 300000: return 300
        if price <= 500000: return 400
        if price <= 1000000: return 500
        return 600
    if s == "SA":
        if price <= 100000: return 150
        if price <= 200000: return 200
        if price <= 300000: return 300
        if price <= 500000: return 500
        return 700
    if s == "TAS":
        if price <= 100000: return 100
        if price <= 200000: return 200
        if price <= 350000: return 350
        return 500
    return GOVT_FEES.get(s, {}).get("transferFee", 200)


def _calc_mortgage_reg_fee(price: float, state: str) -> float:
    s = state.upper()
    if s == "NSW": return 164.90
    if s == "VIC": return 121.40
    if s == "QLD": return 196.00
    if s == "WA":
        if price <= 100000: return 181
        return 181 + (price - 100000) * 0.002
    if s == "SA":
        if price <= 100000: return 176
        return 176 + (price - 100000) * 0.002
    if s == "TAS":
        if price <= 10000: return 141
        return 141 + (price - 10000) * 0.004
    if s == "ACT": return 174.00
    if s == "NT":
        if price <= 525000: return 168
        return 168 + (price - 525000) * 0.002
    return 180


class StampDutyRequest(BaseModel):
    price: float = Field(..., gt=0, le=50_000_000)
    state: str
    isFHB: bool = False
    propertyType: Literal["established", "new_home", "vacant_land"] = "established"


class LoanRepaymentRequest(BaseModel):
    loanAmount: float = Field(..., gt=0, le=50_000_000)
    interestRate: float = Field(..., ge=0, le=30)
    loanTermYears: int = Field(..., ge=1, le=50)


class BorrowingPowerRequest(BaseModel):
    annualIncome: float = Field(..., gt=0, le=10_000_000)
    annualExpenses: float = Field(0, ge=0, le=10_000_000)
    interestRate: float = 6.2


class AffordabilityRequest(BaseModel):
    deposit: float
    state: str
    lvr: float = 0.8
    annualIncome: float = 150000
    monthlyDebt: float = 0
    interestRate: float = 6.2
    bufferRate: float = 3.0
    isFHB: bool = False


class ROIRequest(BaseModel):
    purchasePrice: float
    weeklyRent: float
    state: str
    depositPct: float = 0.2
    interestRate: float = 6.2
    loanType: Literal["io", "pi"] = "pi"
    strata: float = 0
    rates: float = 0
    water: float = 0
    insurance: float = 0
    pmFeePct: float = 0
    vacancyWeeks: float = 0
    maintenancePct: float = 0
    salary: float = 0
    depreciation: float = 0


@router.post("/stamp-duty")
def stamp_duty(req: StampDutyRequest):
    s = req.state.upper()
    raw_duty = _calculate_stamp_duty_raw(req.price, s)
    duty = raw_duty
    fhcs = FIRST_HOME_CONCESSION.get(s)
    if req.isFHB and fhcs:
        if req.price <= fhcs["fullExemption"]:
            duty = 0
        elif fhcs["concessionalRange"][0] < req.price <= fhcs["concessionalRange"][1]:
            duty = raw_duty * fhcs["concessionalDutyReduction"]

    fhog = 0
    if req.isFHB:
        scheme = FHOG.get(s)
        if scheme:
            if req.propertyType == "new_home" and req.price <= scheme["cap_new"]:
                fhog = scheme["new_home"]
            elif req.propertyType == "established" and req.price <= scheme["cap_established"]:
                fhog = scheme["established"]
            elif req.propertyType == "vacant_land" and req.price <= scheme["cap_new"]:
                fhog = scheme["vacant_land"]

    mortgage_reg = _calc_mortgage_reg_fee(req.price, s)
    transfer_fee = _calc_transfer_fee(req.price, s)
    total = duty + mortgage_reg + transfer_fee

    return {
        "duty": round(duty, 2),
        "mortgageRegFee": round(mortgage_reg, 2),
        "transferFee": round(transfer_fee, 2),
        "totalGovtFees": round(total, 2),
        "fhog": fhog,
        "rawDuty": round(raw_duty, 2),
        "upfrontCosts": round(total - fhog, 2),
    }


@router.post("/loan-repayment")
def loan_repayment(req: LoanRepaymentRequest):
    monthly_rate = req.interestRate / 100 / 12
    n_payments = req.loanTermYears * 12

    if monthly_rate == 0:
        monthly = req.loanAmount / n_payments
    else:
        monthly = req.loanAmount * (monthly_rate * (1 + monthly_rate) ** n_payments) / ((1 + monthly_rate) ** n_payments - 1)

    total_repayable = monthly * n_payments
    total_interest = total_repayable - req.loanAmount

    return {
        "monthlyRepayment": round(monthly, 2),
        "totalRepayable": round(total_repayable, 2),
        "totalInterest": round(total_interest, 2),
        "numberOfPayments": n_payments,
    }


@router.post("/borrowing-power")
def calculate_borrowing_power(req: BorrowingPowerRequest):
    assessment_rate = req.interestRate + 3.0
    
    monthly_income = req.annualIncome / 12
    monthly_expenses = req.annualExpenses / 12
    
    available_monthly = monthly_income - monthly_expenses
    if available_monthly <= 0:
        return {"estimatedBorrowingPower": 0, "maxMonthlyRepayment": 0, "assessmentRate": assessment_rate}
        
    monthly_rate = (assessment_rate / 100) / 12
    n_months = 30 * 12
    
    pv = available_monthly * (1 - (1 + monthly_rate)**-n_months) / monthly_rate
    
    return {
        "estimatedBorrowingPower": round(pv),
        "maxMonthlyRepayment": round(available_monthly, 2),
        "assessmentRate": round(assessment_rate, 2),
    }


@router.post("/affordability")
def affordability(req: AffordabilityRequest):
    s = req.state.upper()
    effective_lvr = min(req.lvr, 0.95) if req.isFHB else min(req.lvr, 0.90)

    gross_monthly = req.annualIncome / 12
    net_monthly = gross_monthly * 0.75
    living_expenses = max(2500, net_monthly * 0.3)
    available = net_monthly - living_expenses - req.monthlyDebt
    assessment_rate = (req.interestRate + req.bufferRate) / 100
    monthly_rate = assessment_rate / 12
    n_per = 30 * 12

    borrowing_capacity = 0
    if available > 0:
        borrowing_capacity = available * ((1 - (1 + monthly_rate) ** (-n_per)) / monthly_rate)
    borrowing_capacity = max(0, int(borrowing_capacity))

    lo, hi = req.deposit, req.deposit * 20
    for _ in range(50):
        mid = (lo + hi) / 2
        loan_for_lvr = mid * effective_lvr
        sd = _calculate_stamp_duty_raw(mid, s) if not req.isFHB else _calculate_stamp_duty_raw(mid, s)
        actual_loan = min(loan_for_lvr, borrowing_capacity)

        lmi = 0
        ratio = actual_loan / mid if mid > 0 else 0
        if ratio > 0.8:
            if req.isFHB and mid <= 800000 and ratio <= 0.95:
                lmi = 0
            else:
                if ratio <= 0.85: lmi_rate = 0.012
                elif ratio <= 0.90: lmi_rate = 0.019
                elif ratio <= 0.95: lmi_rate = 0.031
                else: lmi_rate = 0.045
                lmi = actual_loan * lmi_rate

        capitalised_lmi = min(lmi, max(0, borrowing_capacity - actual_loan))
        upfront_lmi = lmi - capitalised_lmi
        deposit_needed = mid - actual_loan + sd + upfront_lmi

        if deposit_needed <= req.deposit:
            lo = mid
        else:
            hi = mid

    max_price = int(lo)
    sd_max = int(_calculate_stamp_duty_raw(max_price, s))
    max_borrow = min(int(max_price * effective_lvr), borrowing_capacity)
    fhbg = req.isFHB and max_price <= 800000 and 0.8 < (max_borrow / max_price if max_price > 0 else 0) <= 0.95

    lmi_max = 0
    if not fhbg and max_price > 0:
        r = max_borrow / max_price
        if r > 0.8:
            if r <= 0.85: lr = 0.012
            elif r <= 0.90: lr = 0.019
            elif r <= 0.95: lr = 0.031
            else: lr = 0.045
            lmi_max = int(max_borrow * lr)

    limited_by = "Serviceability" if max_borrow >= borrowing_capacity - 1000 else "Deposit/LVR"

    return {
        "maxPrice": max_price,
        "maxBorrow": max_borrow,
        "stampDuty": sd_max,
        "lmi": lmi_max,
        "borrowingCapacity": borrowing_capacity,
        "limitedBy": limited_by,
        "fhbgEligible": fhbg,
        "effectiveLvr": effective_lvr,
    }


@router.post("/roi")
def roi_calc(req: ROIRequest):
    s = req.state.upper()
    deposit = req.purchasePrice * req.depositPct
    loan_amount = req.purchasePrice - deposit
    sd = _calculate_stamp_duty_raw(req.purchasePrice, s)
    mortgage_reg = _calc_mortgage_reg_fee(req.purchasePrice, s)
    transfer_fee = _calc_transfer_fee(req.purchasePrice, s)
    upfront = deposit + sd + mortgage_reg + transfer_fee

    annual_interest = loan_amount * (req.interestRate / 100)
    annual_rent = req.weeklyRent * 52
    annual_strata = req.strata * 52
    annual_rates = req.rates * 4
    annual_water = req.water * 4
    annual_insurance = req.insurance
    annual_pm = annual_rent * (req.pmFeePct / 100) if req.pmFeePct else 0
    annual_vacancy = annual_rent * (req.vacancyWeeks / 52)
    annual_maintenance = annual_rent * (req.maintenancePct / 100) if req.maintenancePct else 0

    total_annual_expenses = (
        annual_interest + annual_strata + annual_rates + annual_water +
        annual_insurance + annual_pm + annual_vacancy + annual_maintenance
    )

    net_annual_income = annual_rent - total_annual_expenses
    net_yield = (net_annual_income / req.purchasePrice * 100) if req.purchasePrice > 0 else 0
    cash_on_cash = (net_annual_income / upfront * 100) if upfront > 0 else 0
    weekly_cashflow = net_annual_income / 52

    gearing = "Negative" if net_annual_income < 0 else ("Neutral" if net_annual_income == 0 else "Positive")

    tax_saving = 0
    if req.salary > 0 and net_annual_income < 0:
        taxable_income = req.salary + net_annual_income
        if taxable_income > 0:
            if taxable_income <= 18200: marginal = 0
            elif taxable_income <= 45000: marginal = 0.19
            elif taxable_income <= 120000: marginal = 0.325
            elif taxable_income <= 180000: marginal = 0.37
            else: marginal = 0.45
            tax_saving = abs(net_annual_income) * marginal + req.depreciation * marginal

    return {
        "netYield": round(net_yield, 2),
        "cashOnCashReturn": round(cash_on_cash, 2),
        "weeklyCashflow": round(weekly_cashflow, 2),
        "annualNetIncome": round(net_annual_income, 2),
        "totalUpfrontCosts": round(upfront, 2),
        "stampDuty": round(sd, 2),
        "gearing": gearing,
        "annualInterest": round(annual_interest, 2),
        "annualRent": round(annual_rent, 2),
        "totalAnnualExpenses": round(total_annual_expenses, 2),
        "taxSaving": round(tax_saving, 2),
        "afterTaxPosition": round(net_annual_income + tax_saving, 2),
    }
