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
  
  // NOU: Aici stocăm datele utilizatorului dacă are sesiune duplicată
  const [conflictUser, setConflictUser] = useState(null)

  const [roomCode, setRoomCode] = useState('')
  const [inRoom, setInRoom] = useState(false)
  const [mySymbol, setMySymbol] = useState(null) 
  const [players, setPlayers] = useState({ X: null, O: null }) 
  const [board, setBoard] = useState(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState(true)
  const [xMoves, setXMoves] = useState([]) 
  const [oMoves, setOMoves] = useState([]) 
  const [xStartedThisGame, setXStartedThisGame] = useState(true) 

  // Conectăm socket-ul imediat după login ca să ne poată anunța serverul!
  useEffect(() => {
    if (isLoggedIn && playerData) {
      socket.connect();
      socket.emit('register_user', { username: playerData });
    }
  }, [isLoggedIn, playerData]);

  useEffect(() => {
    socket.on('update_board', (data) => {
      setBoard(data.board); setXIsNext(data.xIsNext);
      if (data.xMoves) setXMoves(data.xMoves);
      if (data.oMoves) setOMoves(data.oMoves);
      if (data.xStarted !== undefined) setXStartedThisGame(data.xStarted);
    });

    socket.on('assign_symbol', (data) => setMySymbol(data.symbol));
    socket.on('room_players', (data) => setPlayers(data));

    // NOU: Ascultăm comanda de "Kick" de la server
    socket.on('force_logout', () => {
      setIsLoggedIn(false);
      setInRoom(false);
      setRoomCode('');
      setBoard(Array(9).fill(null));
      setXMoves([]);
      setOMoves([]);
      setMySymbol(null);
      setPlayers({ X: null, O: null });
      setConflictUser(null);
      socket.disconnect(); // Închidem fizic "telefonul"
      setMessage("Sesiune încheiată! Contul a fost accesat de pe alt dispozitiv.");
    });

    return () => {
      socket.off('update_board'); socket.off('assign_symbol'); socket.off('room_players'); socket.off('force_logout');
    };
  }, []);

  // Am adăugat parametrul `force`
  const handleAuth = async (endpoint, force = false) => {
    if (!username || !password) {
      setMessage("Te rog introdu un nume și o parolă!"); return;
    }
    try {
      const response = await fetch(`http://127.0.0.1:5000/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, force })
      })
      
      // Dacă primim eroare 409 (Conflict de Logare), afișăm meniul Oops!
      if (response.status === 409) {
        const data = await response.json();
        if (data.error === "already_logged_in") {
          setConflictUser({ username, password });
          return;
        }
      }

      const data = await response.json()
      if (response.ok) {
        setConflictUser(null);
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
    if (!roomCode) { setMessage("Introdu un cod de cameră!"); return; }
    socket.emit('join', { room: roomCode, username: playerData });
    setInRoom(true); setMessage('');
  }

  const handleLeaveRoom = () => {
    socket.emit('leave', { room: roomCode, username: playerData });
    setInRoom(false); setRoomCode(''); setBoard(Array(9).fill(null));
    setXMoves([]); setOMoves([]); setXIsNext(true); setMySymbol(null); setPlayers({ X: null, O: null });
  }

  const handleSquareClick = (index) => {
    const winner = calculateWinner(board);
    if (board[index] || winner) return; 
    const currentTurnSymbol = xIsNext ? 'X' : 'O';
    if (mySymbol !== currentTurnSymbol) return; 
    
    const newBoard = [...board]; let newXMoves = [...xMoves]; let newOMoves = [...oMoves];
    if (mySymbol === 'X') {
      newXMoves.push(index); if (newXMoves.length > 3) { newBoard[newXMoves.shift()] = null; }
    } else {
      newOMoves.push(index); if (newOMoves.length > 3) { newBoard[newOMoves.shift()] = null; }
    }
    newBoard[index] = mySymbol;
    setBoard(newBoard); setXIsNext(!xIsNext); setXMoves(newXMoves); setOMoves(newOMoves);
    
    socket.emit('move', { room: roomCode, board: newBoard, xIsNext: !xIsNext, xMoves: newXMoves, oMoves: newOMoves });
  }

  // ==========================================
  // ECRANUL OOPS! (Conflict de conectare)
  // ==========================================
  if (conflictUser) {
    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center text-white p-4">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          <div className="mb-8">
            <h2 className="text-4xl font-extrabold mb-4">Oops! 🚨</h2>
            <p className="text-indigo-200">Se pare că ești deja conectat cu contul <span className="font-bold text-white">{conflictUser.username}</span> pe un alt dispozitiv sau într-un alt tab.</p>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={() => handleAuth('login', true)}
              className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 py-4 rounded-xl font-bold shadow-lg"
            >
              Switch here (Închide cealaltă sesiune)
            </button>
            <button 
              onClick={() => { setConflictUser(null); setUsername(''); setPassword(''); }}
              className="w-full bg-white/10 hover:bg-white/20 py-4 rounded-xl font-bold border border-white/20"
            >
              Login with another account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ECRANUL 3: TABLA DE JOC
  if (isLoggedIn && inRoom) {
    const winner = calculateWinner(board);
    const isDraw = !winner && board.every(square => square !== null); 
    const currentTurnSymbol = xIsNext ? 'X' : 'O';
    const currentTurnName = players[currentTurnSymbol] || currentTurnSymbol;
    const isRoomFull = players.X && players.O;
    const oldestXMove = xMoves.length === 3 ? xMoves[0] : null;
    const oldestOMove = oMoves.length === 3 ? oMoves[0] : null;

    let statusMessage = winner ? `🎉 Câștigător: ${players[winner] || winner}!` : isDraw ? "🤝 Remiză!" : !isRoomFull ? "⏳ Așteptăm adversarul..." : mySymbol === currentTurnSymbol ? "E rândul tău!" : `Așteaptă... e rândul lui ${currentTurnName}`;

    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4">
        <div className={`bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl w-full max-w-md text-center transition-all duration-500 border-4 ${isRoomFull ? 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-gray-400/30 border-dashed'}`}>
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <div className="text-left">
              <h1 className="text-xl font-bold">{playerData} <span className="text-sm font-normal opacity-80">(Tu ești {mySymbol})</span></h1>
              <p className="text-sm text-indigo-300">Vs: {mySymbol === 'X' ? (players.O || 'Așteptare jucător...') : (players.X || 'Așteptare jucător...')}</p>
            </div>
            <div className="flex flex-col items-end gap-2"><span className="bg-white/20 px-3 py-1 rounded-full text-sm font-mono tracking-widest">{roomCode}</span></div>
          </div>
          
          <p className={`mb-8 text-xl font-bold ${winner ? 'text-green-400 animate-bounce' : isRoomFull ? 'text-indigo-200' : 'text-gray-400 animate-pulse'}`}>{statusMessage}</p>
          
          <div className="grid grid-cols-3 gap-3 w-full aspect-square p-4 bg-white/5 rounded-2xl border border-white/10">
            {board.map((value, index) => {
              const isOldest = (value === 'X' && index === oldestXMove) || (value === 'O' && index === oldestOMove);
              return (
                <button 
                  key={index} onClick={() => !winner && isRoomFull && handleSquareClick(index)} 
                  className={`bg-white/10 rounded-xl flex items-center justify-center text-6xl font-black transition-all ${(winner || mySymbol !== currentTurnSymbol || value || !isRoomFull) ? 'cursor-not-allowed opacity-80' : 'hover:bg-white/20 active:scale-95'}`}
                >
                  {value === 'X' ? <span className={`text-blue-400 transition-opacity duration-300 ${isOldest && !winner ? 'opacity-30 animate-pulse' : ''}`}>X</span> : value === 'O' ? <span className={`text-red-400 transition-opacity duration-300 ${isOldest && !winner ? 'opacity-30 animate-pulse' : ''}`}>O</span> : ''}
                </button>
              )
            })}
          </div>

          {(winner || isDraw) && (
            <button onClick={() => { 
                const emptyBoard = Array(9).fill(null); const nextGameXStarts = !xStartedThisGame; 
                setBoard(emptyBoard); setXIsNext(nextGameXStarts); setXMoves([]); setOMoves([]); setXStartedThisGame(nextGameXStarts);
                socket.emit('move', { room: roomCode, board: emptyBoard, xIsNext: nextGameXStarts, xMoves: [], oMoves: [], xStarted: nextGameXStarts });
              }} className="mt-6 w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 py-3 rounded-xl font-bold"
            >Joacă din nou (Schimbă rândul)</button>
          )}
          <button onClick={handleLeaveRoom} className="mt-4 w-full bg-red-500/10 hover:bg-red-500/30 text-red-300 py-3 rounded-xl font-bold transition-all border border-red-500/20 active:scale-95">Ieși din cameră</button>
        </div>
      </div>
    )
  }

  // ECRANUL 2: LOBBY
  if (isLoggedIn && !inRoom) {
    return (
      <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <h1 className="text-2xl font-extrabold">Lobby</h1>
            <button onClick={() => { setIsLoggedIn(false); setPlayerData(null); socket.disconnect(); }} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 px-4 py-2 rounded-lg text-sm font-bold">Deconectare</button>
          </div>
          <p className="text-indigo-200 mb-8">Salut, {playerData}! Creează sau intră într-o cameră de joc.</p>
          <div className="space-y-4">
            <input type="text" placeholder="Ex: BGG2026" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/10 transition-all uppercase text-center font-bold tracking-widest" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
            <button onClick={handleJoinRoom} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 py-4 rounded-xl font-bold text-lg shadow-lg">Intră în Cameră</button>
          </div>
        </div>
      </div>
    )
  }

  // ECRANUL 1: AUTENTIFICARE
  return (
    <div className="h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center text-white p-4">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md">
        <div className="text-center mb-8"><h1 className="text-4xl font-extrabold tracking-tight mb-2">Tic-Tac-Toe</h1><p className="text-indigo-200">Proiect Erasmus 2026</p></div>
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