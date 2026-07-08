import sys
sys.path.append('backend')
from app.database import SessionLocal
from app.models import SuburbUIModel
from sqlalchemy import func

db = SessionLocal()
print('Live true with price:', db.query(SuburbUIModel).filter(SuburbUIModel.is_live == True, SuburbUIModel.median_price > 0).count())
print('Live false with price:', db.query(SuburbUIModel).filter(SuburbUIModel.is_live == False, SuburbUIModel.median_price > 0).count())
print('Live false without price:', db.query(SuburbUIModel).filter(SuburbUIModel.is_live == False, (SuburbUIModel.median_price == None) | (SuburbUIModel.median_price == 0)).count())
