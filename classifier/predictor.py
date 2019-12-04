from joblib import load
import os
import sys
import json
import numpy as np

titleClassifier=load(os.path.dirname(os.path.realpath(__file__))+"/"+"title_classifier.joblib")
contentClassifier=load(os.path.dirname(os.path.realpath(__file__))+"/"+"content_classifier.joblib")
scaler_title=load(os.path.dirname(os.path.realpath(__file__))+"/"+"scaler_title.joblib")
scaler_content=load(os.path.dirname(os.path.realpath(__file__))+"/"+"scaler_content.joblib")

f = open(os.path.dirname(os.path.realpath(__file__))+"/"+"datasetinfo.txt", "r")
freqs=json.loads(f.readline().rstrip('\n'))
cols_title=f.readline().rstrip('\n').split(",")
tag_title_blacklist=f.readline().rstrip('\n').split(",")
cols_content=f.readline().rstrip('\n').split(",")
tag_content_blacklist=f.readline().rstrip('\n').split(",")



import argparse
parser = argparse.ArgumentParser(description='Enter file containing elements to predict')
parser.add_argument('-i','--input',help='a file container elements to predict',default=sys.stdin)
parser.add_argument('-o','--output',help='a file prediction should be saved',default=sys.stdout)

args = parser.parse_args()

import pandas as pd
data = pd.read_csv(args.input, quotechar='"', skipinitialspace=True)
data['tagName']=data['tagName'].str.upper()
result=pd.DataFrame(data['crawlerId'])
result['title']=[0]*result.shape[0]
result['content']=[0]*result.shape[0]


def predict(data,black_list,model_cols,freqs,scaler,model):
    data_white=data[~data['tagName'].isin(black_list)]
    data_dummy=pd.get_dummies(data_white,columns=['tagName','textAlign'])

    crawlerIds=data_dummy['crawlerId']

    data_final=pd.DataFrame(data_dummy['crawlerId']);
    for col in model_cols:
        if col in data_dummy.columns:
            data_final[col]=data_dummy[col];
        else:
            data_final[col]=[0]*data_dummy.shape[0]

    for obj_col in data_final.columns[data_final.dtypes=='O'].values:
        data_final[obj_col]=pd.to_numeric(data_final[obj_col],errors='coerce')
        data_final[obj_col] = data_final[obj_col].fillna(freqs[obj_col])

    data_final=data_final.drop('crawlerId',axis=1)
    X=scaler.transform(data_final)
    pred_proba=model.predict_proba(X)
    max_prob=pred_proba.argmax(axis=0)[1]
    return crawlerIds.to_numpy()[max_prob]

title_id=predict(data,tag_title_blacklist,cols_title,freqs,scaler_title,titleClassifier)
content_id=predict(data,tag_content_blacklist,cols_content,freqs,scaler_content,contentClassifier)


print('title: [',title_id,']')
print('content: [',content_id,']')

