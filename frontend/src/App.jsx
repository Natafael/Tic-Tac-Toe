function App() {
  return (
    <div className="h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
      <div className="bg-white p-10 rounded-2xl shadow-2xl text-center">
        <h1 className="text-3xl font-extrabold text-gray-800 mb-4">
          Tailwind este activ! 🚀
        </h1>
        <p className="text-gray-600">Proiectul Erasmus: Tic-Tac-Toe</p>
        <div className="mt-6">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
            Buton cu stil Tailwind
          </button>
        </div>
      </div>
    </div>
  )
}

export default App