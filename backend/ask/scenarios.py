from typing import Optional, Dict, Any, List
import buyfinder

def compute_affordability(
    budget: Optional[float], 
    deposit: Optional[float], 
    income: Optional[float], 
    debt: Optional[float], 
    state: str,
    property_type: str,
    price: float
) -> Dict[str, Any]:
    
    if not income or not deposit or not budget:
        return {"serviceability_passed": False, "reason": "Missing inputs"}
        
    stamp_duty = buyfinder.calculate_stamp_duty(state, price, "first_home_buyer") # simplifying to fhb or standard
    purchase_costs = price * 0.02 + stamp_duty
    available_deposit = float(deposit) - purchase_costs
    required_loan = max(0, price - max(0, available_deposit))
    
    # 6.20% rate + 3% buffer
    rate = 0.062 
    buffer = 0.03
    
    borrowing_capacity = buyfinder.compute_borrowing_capacity(
        float(income), float(debt) if debt else 0.0, rate, buffer, 30
    )
    
    repayment = buyfinder.compute_repayment(required_loan, rate, buffer, 30)
    
    serviceability_passed = required_loan <= borrowing_capacity and borrowing_capacity > 0
    
    return {
        "serviceability_passed": serviceability_passed,
        "borrowing_capacity": borrowing_capacity,
        "required_loan": required_loan,
        "monthly_repayment": repayment,
        "stamp_duty": stamp_duty,
        "purchase_costs": purchase_costs,
        "available_deposit_after_costs": available_deposit
    }

def compute_yield(price: float, weekly_rent: float) -> float:
    if not price or not weekly_rent:
        return 0.0
    return (weekly_rent * 52) / price * 100
