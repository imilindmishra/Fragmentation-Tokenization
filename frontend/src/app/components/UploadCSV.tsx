"use client";
import { useState } from "react";
import axios from "axios";
import { useDropzone } from "react-dropzone";

export default function UploadCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { "text/csv": [".csv"] },
    onDrop: (acceptedFiles) => setFile(acceptedFiles[0]),
  });

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file.");
    setUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:5000/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert("Upload successful: " + response.data.message);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Upload failed. Check console for errors.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center p-6 border rounded-lg shadow-md">
      <div {...getRootProps()} className="p-4 border-2 border-dashed cursor-pointer">
        <input {...getInputProps()} />
        <p>{file ? `Selected File: ${file.name}` : "Drag & drop a CSV file here, or click to select"}</p>
      </div>
      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        onClick={handleUpload}
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Upload CSV"}
      </button>
    </div>
  );
}
