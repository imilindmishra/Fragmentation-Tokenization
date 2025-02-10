from flask import Flask, request, jsonify
import pandas as pd
from presidio_analyzer import AnalyzerEngine

app = Flask(__name__)
analyzer = AnalyzerEngine()

@app.route("/detect-pii", methods=["POST"])
def detect_pii():
    try:
        print("Headers:", request.headers)  # Log headers
        print("Content-Type:", request.content_type)  # Check content type
        print("Files:", request.files)  # Debug uploaded files

        if "file" not in request.files:
            return jsonify({"error": "No file uploaded. Ensure 'file' is in form-data."}), 400

        file = request.files["file"]
        df = pd.read_csv(file)
        pii_results = {}

        for column in df.columns:
            pii_values = []

            for _, row in df.iterrows():
                text = str(row[column]).strip()
                if not text:
                    continue

                results = analyzer.analyze(text=text, entities=[], language="en")

                for result in results:
                    pii_values.append({"value": text, "type": result.entity_type})

            if pii_values:
                pii_results[column] = pii_values

        return jsonify({"pii_values": pii_results})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
