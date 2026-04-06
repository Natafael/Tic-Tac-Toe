import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://127.0.0.1:5000', { autoConnect: false });

function calculateWinner(squares) {
  const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) return squares[a];
  }
  return null;
}

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [playerData, setPlayerData] = useState(null)
  
  const [roomCode, setRoomCode] = useState('')
  const [inRoom, setInRoom] = useState(false)

  // STĂRI NOI PENTRU ROLURI ȘI NUME
  const [mySymbol, setMySymbol] = useState(null) // Va fi 'X' sau 'O'
  const [players, setPlayers] = useState({ X: null, O: null }) // Dicționar cu numele jucătorilor

  const [board, setBoard] = useState(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState(true)

  useEffect(() => {
    socket.on('update_board', (data) => {
      setBoard(data.board);
      setXIsNext(data.xIsNext);
    });

    // Ascultăm ce simbol primim de la server
    socket.on('assign_symbol', (data) => {
      setMySymbol(data.symbol);
    });

    // Ascultăm cine sunt jucătorii din cameră
    socket.on('room_players', (data) => {
      setPlayers(data);
    });

    return () => {
      socket.off('update_board');
      socket.off('assign_symbol');
      socket.off('room_players');
    };
  }, []);

  const handleAuth = async (endpoint) => {
    if (!username || !password) {
      setMessage("Te rog introdu un nume și o parolă!");
      return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await response.json()
      if (response.ok) {
        setPlayerData(username); 
        setIsLoggedIn(true);     
      } else {
        setMessage(`Eroare: ${data.error}`);
      }
    } catch (error) {
      setMessage("Eroare: Serverul Backend nu este pornit!");
    }
  }

  const handleJoinRoom = () => {
    if (!roomCode) {
      setMessage("Introdu un cod de cameră!");
      return;
    }
    socket.connect();
    socket.emit('join', { room: roomCode, username: playerData });
    setInRoom(true);
    setMessage('');
  }

  const handleSquareClick = (index) => {
    const winner = calculateWinner(board);
    // Dacă pătratul e luat sau jocul e gata, ieșim
    if (board[index] || winner) return; 
    
    // Aflăm a cui e rândul teoretic (X sau O)
    const currentTurnSymbol = xIsNext ? 'X' : 'O';

    // BLOCAJUL MAJOR: Dacă nu e rândul tău, te oprim din a pune pe tablă!
    if (mySymbol !== currentTurnSymbol) {
      return; 
    }
    
    const newBoard = [...board];
    newBoard[index] = mySymbol; // Folosim simbolul tău sigur, nu cel calculat local
    
    setBoard(newBoard);
    setXIsNext(!xIsNext);
    
    socket.emit('move', { room: roomCode, board: newBoard, xIsNext: !xIsNext });
  }

  if (isLoggedIn && inRoom) {
    const winner = calculateWinner(board);
    const isDraw = !winner && board.every(square => square !== null);
    
    const currentTurnSymbol = xIsNext ? 'X' : 'O';
    // Căutăm numele jucătorului care urmează; dacă nu există încă, afișăm doar X sau O
    const currentTurnName = players[currentTurnSymbol] || currentTurnSymbol;
    
    let statusMessage;
    if (winner) {
      statusMessage = `🎉 Câștigător: ${players[winner] || winner}!`;
    } else if (isDraw) {
      statusMessage = "🤝 Remiză!";
    } else {
      // Afișăm dacă e rândul tău sau rândul oponentului
      statusMessage = mySymbol === currentTurnSymbol ? "E rândul tău!" : `Așteaptă... e rândul lui ${currentTurnName}`;
    }

    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          
          {/* Header cu jucătorii și simbolurile lor */}
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <div className="text-left">
              <h1 className="text-xl font-bold">{playerData} <span className="text-sm font-normal opacity-80">(Tu ești {mySymbol})</span></h1>
              <p className="text-sm text-indigo-300">
                Vs: {mySymbol === 'X' ? (players.O || 'Așteptare jucător...') : (players.X || 'Așteptare jucător...')}
              </p>
            </div>
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-mono tracking-widest">{roomCode}</span>
          </div>
          
          {/* Mesajul care spune a cui e rândul */}
          <p className={`mb-8 text-xl font-bold ${winner ? 'text-green-400 animate-bounce' : isDraw ? 'text-yellow-400' : 'text-indigo-200'}`}>
            {statusMessage}
          </p>
          
          <div className="grid grid-cols-3 gap-3 w-full aspect-square p-4 bg-white/5 rounded-2xl border border-white/10">
            {board.map((value, index) => (
              <button 
                key={index} 
                onClick={() => !winner && handleSquareClick(index)} 
                // Schimbăm puțin designul dacă NU e rândul tău (cursor interzis)
                className={`bg-white/10 rounded-xl flex items-center justify-center text-6xl font-black transition-all 
                  ${(winner || mySymbol !== currentTurnSymbol || value) ? 'cursor-not-allowed opacity-80' : 'hover:bg-white/20 active:scale-95'}`}
              >
                {value === 'X' ? <span className="text-blue-400">X</span> : value === 'O' ? <span className="text-red-400">O</span> : ''}
              </button>
            ))}
          </div>

          {(winner || isDraw) && (
            <button 
              onClick={() => { 
                const emptyBoard = Array(9).fill(null);
                setBoard(emptyBoard); setXIsNext(true); 
                socket.emit('move', { room: roomCode, board: emptyBoard, xIsNext: true });
              }}
              className="mt-6 w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 py-3 rounded-xl font-bold"
            >Joacă din nou</button>
          )}
        </div>
      </div>
    )
  }

  // ECRANUL 2: LOBBY
  if (isLoggedIn && !inRoom) {
    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          <h1 className="text-3xl font-extrabold mb-2">Lobby Principal</h1>
          <p className="text-indigo-200 mb-8">Salut, {playerData}! Creează sau intră într-o cameră de joc.</p>
          
          <div className="space-y-4">
            <input type="text" placeholder="Ex: BGG2026" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/10 transition-all uppercase text-center font-bold tracking-widest" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
            <button onClick={handleJoinRoom} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-4 rounded-xl font-bold text-lg shadow-lg">Intră în Cameră</button>
          </div>
          {message && <div className="mt-4 text-red-300 font-medium">{message}</div>}
        </div>
      </div>
    )
  }

  // ECRANUL 1: AUTENTIFICARE
  return (
    <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center text-white p-4">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight mb-2">Tic-Tac-Toe</h1>
          <p className="text-indigo-200">Proiect Erasmus 2026</p>
        </div>
        
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-indigo-200 mb-2 ml-1">Nume Jucător</label><input type="text" placeholder="Ex: Oaia Verde" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><label className="block text-sm font-medium text-indigo-200 mb-2 ml-1">Parolă</label><input type="password" placeholder="••••••••" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="flex gap-4 pt-4">
            <button onClick={() => handleAuth('login')} className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-md border border-white/20">Logare</button>
            <button onClick={() => handleAuth('register')} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 py-3 rounded-xl font-bold text-md">Creare Cont</button>
          </div>
        </div>
        {message && <div className="mt-6 p-3 rounded-lg text-center text-sm font-medium bg-red-500/20 text-red-200">{message}</div>}
      </div>
    </div>
  )
}

export default App