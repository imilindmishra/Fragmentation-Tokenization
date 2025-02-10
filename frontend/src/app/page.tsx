import FileUpload from "./components/FileUpload";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Quantum Fragmented Tokenization</h1>
      <FileUpload />
    </main>
  );
}
