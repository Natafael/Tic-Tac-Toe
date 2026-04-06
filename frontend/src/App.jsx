import { useState } from 'react'

function calculateWinner(squares) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Linii orizontale
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Coloane verticale
    [0, 4, 8], [2, 4, 6]             // Diagonale
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a]; // Returnează 'X' sau 'O'
    }
  }
  return null; // Nimeni nu a câștigat încă
}

function App() {
  // --- STĂRI PENTRU AUTENTIFICARE ---
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  
  // --- STĂRI PENTRU JOC ---
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [playerData, setPlayerData] = useState(null)
  // Creăm o tablă goală cu 9 poziții (null)
  const [board, setBoard] = useState(Array(9).fill(null))
  // Urmărim a cui e rândul (X începe primul)
  const [xIsNext, setXIsNext] = useState(true)

  // --- FUNCȚIA DE COMUNICARE CU SERVERUL ---
  const handleAuth = async (endpoint) => {
    if (!username || !password) {
      setMessage("Te rog introdu un nume și o parolă!");
      return;
    }

    try {
      const response = await fetch(`http://127.0.0.1:5000/${endpoint}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify({ username, password })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Succes! Salvăm numele jucătorului și schimbăm ecranul
        setPlayerData(username); 
        setIsLoggedIn(true);     
      } else {
        setMessage(`Eroare: ${data.error}`);
      }
    } catch (error) {
      setMessage("Eroare: Serverul Backend nu este pornit!");
    }
  }

  // --- FUNCȚIA PENTRU CLICK PE TABLĂ ---
  const handleSquareClick = (index) => {
    // Dacă pătratul are deja X sau O, nu face nimic
    if (board[index]) return; 
    
    // Facem o copie a tablei, punem X sau O, și actualizăm starea
    const newBoard = [...board];
    newBoard[index] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext); // Schimbăm rândul
  }

  // ==========================================
  // ECRANUL 2: LOBBY / TABLA DE JOC (După logare)
  // ==========================================
  if (isLoggedIn) {
    // Calculăm dacă avem un câștigător înainte de a randa ecranul
    const winner = calculateWinner(board);
    // Verificăm dacă e remiză (nu mai sunt spații goale și nu avem câștigător)
    const isDraw = !winner && board.every(square => square !== null);

    // Mesajul dinamic pe care îl afișăm deasupra tablei
    let statusMessage;
    if (winner) {
      statusMessage = `🎉 Câștigător: ${winner}!`;
    } else if (isDraw) {
      statusMessage = "🤝 Remiză!";
    } else {
      statusMessage = `Urmează la rând: ${xIsNext ? 'X' : 'O'}`;
    }

    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          <h1 className="text-3xl font-extrabold mb-2">Lobby: {playerData}</h1>
          
          {/* Aici afișăm mesajul de status cu culori dinamice */}
          <p className={`mb-8 text-xl font-bold ${winner ? 'text-green-400 animate-bounce' : isDraw ? 'text-yellow-400' : 'text-indigo-200'}`}>
            {statusMessage}
          </p>
          
          <div className="grid grid-cols-3 gap-3 w-full aspect-square p-4 bg-white/5 rounded-2xl border border-white/10 relative">
            {board.map((value, index) => (
              <button 
                key={index}
                // Dezactivăm butoanele dacă avem deja un câștigător!
                onClick={() => !winner && handleSquareClick(index)} 
                className="bg-white/10 rounded-xl flex items-center justify-center text-6xl font-black hover:bg-white/20 transition-all active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed"
              >
                {value === 'X' ? <span className="text-blue-400">X</span> : value === 'O' ? <span className="text-red-400">O</span> : ''}
              </button>
            ))}
          </div>

          {/* Buton pentru a reseta tabla de joc */}
          {(winner || isDraw) && (
            <button 
              onClick={() => { setBoard(Array(9).fill(null)); setXIsNext(true); }}
              className="mt-6 w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 py-3 rounded-xl font-bold text-md shadow-lg transform transition active:scale-95"
            >
              Joacă din nou
            </button>
          )}
        </div>
      </div>
    )
  }

  // ==========================================
  // ECRANUL 1: AUTENTIFICARE (Înainte de logare)
  // ==========================================
  return (
    <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center text-white p-4">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Tic-Tac-Toe</h1>
          <p className="text-indigo-200">Proiect Erasmus 2026</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2 ml-1">Nume Jucător</label>
            <input 
              type="text" 
              placeholder="Ex: Oaia Verde" 
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/10 transition-all placeholder:text-white/30"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2 ml-1">Parolă</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/10 transition-all placeholder:text-white/30"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              onClick={() => handleAuth('login')}
              className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-md shadow-lg transform transition active:scale-95 border border-white/20"
            >
              Logare
            </button>
            <button 
              onClick={() => handleAuth('register')}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-3 rounded-xl font-bold text-md shadow-lg transform transition active:scale-95"
            >
              Creare Cont
            </button>
          </div>
        </div>

        {message && (
          <div className={`mt-6 p-3 rounded-lg text-center text-sm font-medium animate-pulse ${
            message.includes('Eroare') ? 'bg-red-500/20 text-red-200' : 'bg-green-500/20 text-green-200'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

export default App