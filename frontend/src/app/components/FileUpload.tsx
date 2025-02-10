"use client";
import { useState } from "react";
import axios from "axios";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [piiFields, setPiiFields] = useState<{ [key: string]: string[] } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file.");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file); // Correctly append the file

    try {
      const response = await axios.post("http://localhost:5000/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }, // Ensure correct headers
      });

      setPiiFields(response.data.pii_fields);
      alert("Upload successful!");
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check console for errors.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 border rounded-lg shadow-md w-full max-w-md">
      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="mb-4 border p-2 rounded w-full"
      />
      {file && <p className="mb-2 text-gray-700">Selected File: {file.name}</p>}
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded"
        onClick={handleUpload}
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Upload CSV"}
      </button>

      {piiFields && (
        <div className="mt-4 p-4 border rounded bg-gray-100">
          <h2 className="text-lg font-bold">Detected PII Fields:</h2>
          <ul>
            {Object.entries(piiFields).map(([column, entities]) => (
              <li key={column}>
                <strong>{column}:</strong> {entities.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
