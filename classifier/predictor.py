from joblib import load
import os
import sys
import json
import numpy as np

titleClassifier=load(os.path.dirname(os.path.realpath(__file__))+"/"+"title_classifier.joblib")
contentClassifier=load(os.path.dirname(os.path.realpath(__file__))+"/"+"content_classifier.joblib")
scaler=load(os.path.dirname(os.path.realpath(__file__))+"/"+"scaler.joblib")
f = open(os.path.dirname(os.path.realpath(__file__))+"/"+"datasetinfo.txt", "r")
cols=f.readline().rstrip('\n').split(",")
freqs=json.loads(f.readline().rstrip('\n'))
tag_blacklist=f.readline().rstrip('\n').split(",")



import argparse
parser = argparse.ArgumentParser(description='Enter file containing elements to predict')
parser.add_argument('-i','--input',help='a file container elements to predict',default=sys.stdin)
parser.add_argument('-o','--output',help='a file prediction should be saved',default=sys.stdout)

args = parser.parse_args()

import pandas as pd
data = pd.read_csv(args.input, quotechar='"', skipinitialspace=True)
result=pd.DataFrame(data['crawlerId'])
result['title']=[0]*result.shape[0]
result['content']=[0]*result.shape[0]


data['tagName']=data['tagName'].str.upper()
data=data[~data['tagName'].isin(tag_blacklist)]
data_dummy=pd.get_dummies(data,columns=['tagName','textAlign'])

crawlerIds=data_dummy['crawlerId'];

data_final=pd.DataFrame(data_dummy['crawlerId']);
for col in cols:
    if col in data_dummy.columns:
        data_final[col]=data_dummy[col];
    else:
        data_final[col]=[0]*data_dummy.shape[0]


for obj_col in data_final.columns[data_final.dtypes=='O'].values:
    data_final[obj_col]=pd.to_numeric(data_final[obj_col],errors='coerce')
    data_final[obj_col] = data_final[obj_col].fillna(freqs[obj_col])

data_final=data_final.drop('crawlerId',axis=1);
X=scaler.transform(data_final);
y_pred_title=titleClassifier.predict(X)
y_pred_content=contentClassifier.predict(X)


print('titles:',np.array2string(crawlerIds[y_pred_title==1].values,separator=','))
print('contents:',np.array2string(crawlerIds[y_pred_content==1].values,separator=','))

