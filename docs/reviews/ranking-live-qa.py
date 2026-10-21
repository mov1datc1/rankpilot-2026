"""Official public pages only; no database writes and no customer uploads."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'ai-engine'))
from utils.ranking_verifier import verify_ranking_claim
cases=[('chambers_labour',{'firm_name':'DeForest Abogados','directory':'Chambers','practice_area':'Labour & Employment','jurisdiction':'Mexico','current_band':'Band 2','ranking_edition':'2027'}),('legal500_labour',{'firm_name':'DeForest Abogados','directory':'Legal 500','practice_area':'Labour & Employment','jurisdiction':'Mexico','current_band':'Tier 2','ranking_edition':'2027'}),('chambers_tax',{'firm_name':'ARAQUEREYNA','directory':'Chambers','practice_area':'Tax','jurisdiction':'Venezuela','current_band':'Band 2','ranking_edition':'2027'})]
results=[]
for case,package in cases:
 result=verify_ranking_claim(package);results.append({'case':case,'verification':result});print(case,result['status'],result['observed_band'],flush=True)
 Path(__file__).with_name('ranking-live-qa.json').write_text(json.dumps({'scope':'Live official public sources. Band/Tier 2 are deliberately synthetic comparison claims, NOT Angela declarations. No absence conclusion.','results':results},indent=2,ensure_ascii=False))
