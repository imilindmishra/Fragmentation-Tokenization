import pandas as pd
import requests
import pyinputplus as pyip
import os

# API Endpoints
TOKENIZE_API = "http://127.0.0.1:5000/api/tokenize"
PII_DETECT_API = "http://127.0.0.1:5001/detect-pii"

def tokenize_csv(file_paths):
    for file_path in file_paths:
        print(f"Processing file: {file_path}")
        df = pd.read_csv(file_path)
        print("Available columns:")
        for idx, col in enumerate(df.columns, 1):
            print(f"{idx}. {col}")
        
        choice = pyip.inputMenu(["Complete CSV", "Select Specific Columns"], numbered=True)
        
        if choice == "Select Specific Columns":
            selected_columns = []
            print("Mark columns with '*' and press Enter when done:")
            for col in df.columns:
                ans = input(f"{col} (* to select, press Enter to skip): ")
                if ans.strip() == "*":
                    selected_columns.append(col)
        else:
            selected_columns = list(df.columns)
        
        df_selected = df[selected_columns]
        temp_file = os.path.splitext(file_path)[0] + "_selected.csv"
        df_selected.to_csv(temp_file, index=False)
        
        print(f"📢 Sending {file_path} to PII Detection API...")
        with open(temp_file, "rb") as f:
            files = {"file": f}
            pii_response = requests.post(PII_DETECT_API, files=files)
        
        if pii_response.status_code != 200:
            print(f"❌ PII Detection Failed for {file_path}:", pii_response.json())
            continue
        
        print(f"✅ PII Detection Completed for {file_path}, Sending to Tokenization API...")
        with open(temp_file, "rb") as f:
            files = {"files": f}
            token_response = requests.post(TOKENIZE_API, files=files)
        
        if token_response.status_code == 200:
            print(f"✅ Tokenization Successful for {file_path}!")
            tokenized_data = token_response.json().get("tokenized_data", [])
            
            # Convert tokenized data into structured format
            tokenized_dict = {}
            for entry in tokenized_data:
                column = entry["column"]
                token = entry["token"]
                if column not in tokenized_dict:
                    tokenized_dict[column] = []
                tokenized_dict[column].append(token)
            
            # Create a DataFrame with proper structure
            max_len = max(len(v) for v in tokenized_dict.values())
            for key in tokenized_dict:
                tokenized_dict[key] += [None] * (max_len - len(tokenized_dict[key]))
            
            tokenized_df = pd.DataFrame(tokenized_dict)
            tokenized_file = os.path.splitext(file_path)[0] + "_tokenized.csv"
            tokenized_df.to_csv(tokenized_file, index=False)
            print(f"✅ Tokenized data saved to {tokenized_file}")
        else:
            print(f"❌ Tokenization Failed for {file_path}:", token_response.json())

# Get multiple CSV file paths from user
file_paths = input("Enter CSV file paths separated by commas: ").split(",")
file_paths = [file.strip() for file in file_paths]

# Run the script
tokenize_csv(file_paths)
