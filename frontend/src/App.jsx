import { useState, useEffect, useRef } from 'react'
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
  const [conflictUser, setConflictUser] = useState(null)

  const [showPassword, setShowPassword] = useState(false)

  const [roomCode, setRoomCode] = useState('')
  const [inRoom, setInRoom] = useState(false)
  const [mySymbol, setMySymbol] = useState(null) 
  
  const [players, setPlayers] = useState({ X: null, O: null, spectatorCount: 0 }) 
  const [board, setBoard] = useState(Array(9).fill(null))
  const [xIsNext, setXIsNext] = useState(true)
  const [xMoves, setXMoves] = useState([]) 
  const [oMoves, setOMoves] = useState([]) 
  const [xStartedThisGame, setXStartedThisGame] = useState(true) 
  const [scores, setScores] = useState({ X: 0, O: 0 })

  const [messages, setMessages] = useState([])
  const [currentMessage, setCurrentMessage] = useState('')
  const messagesEndRef = useRef(null) 

  const [isRoomFullLobby, setIsRoomFullLobby] = useState(false)

  useEffect(() => {
    if (roomCode.trim() !== '' && isLoggedIn && !inRoom) {
      fetch(`http://127.0.0.1:5000/room_status/${roomCode}`)
        .then(res => res.json())
        .then(data => setIsRoomFullLobby(data.is_full))
        .catch(() => setIsRoomFullLobby(false));
    } else {
      setIsRoomFullLobby(false);
    }
  }, [roomCode, isLoggedIn, inRoom]);

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
      if (data.scores) setScores(data.scores); 
    });

    socket.on('assign_symbol', (data) => setMySymbol(data.symbol));
    socket.on('room_players', (data) => setPlayers(data));
    socket.on('receive_message', (data) => setMessages((prev) => [...prev, data]));

    socket.on('force_logout', () => {
      setIsLoggedIn(false); setInRoom(false); setRoomCode(''); setBoard(Array(9).fill(null));
      setXMoves([]); setOMoves([]); setMySymbol(null); setPlayers({ X: null, O: null, spectatorCount: 0 });
      setConflictUser(null); setMessages([]); setScores({ X: 0, O: 0 }); socket.disconnect();
      setMessage("Sesiune încheiată! Contul a fost accesat de pe alt dispozitiv.");
    });

    return () => {
      socket.off('update_board'); socket.off('assign_symbol'); socket.off('room_players'); 
      socket.off('force_logout'); socket.off('receive_message');
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAuth = async (endpoint, force = false) => {
    if (!username || !password) { setMessage("Te rog introdu un nume și o parolă!"); return; }
    try {
      const response = await fetch(`http://127.0.0.1:5000/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, force })
      })
      if (response.status === 409) {
        const data = await response.json();
        if (data.error === "already_logged_in") { setConflictUser({ username, password }); return; }
      }
      const data = await response.json()
      if (response.ok) {
        setConflictUser(null); setPlayerData(username); setIsLoggedIn(true);     
      } else { setMessage(`Eroare: ${data.error}`); }
    } catch (error) { setMessage("Eroare: Serverul Backend nu este pornit!"); }
  }

  const handleJoinRoom = (role) => {
    if (!roomCode) { setMessage("Introdu un cod de cameră!"); return; }
    socket.emit('join', { room: roomCode, username: playerData, role: role });
    setInRoom(true); setMessage('');
  }

  const handleLeaveRoom = () => {
    socket.emit('leave', { room: roomCode, username: playerData });
    setInRoom(false); setRoomCode(''); setBoard(Array(9).fill(null));
    setXMoves([]); setOMoves([]); setXIsNext(true); setMySymbol(null); 
    setPlayers({ X: null, O: null, spectatorCount: 0 }); setMessages([]); setScores({ X: 0, O: 0 });
  }

  const handleSendMessage = () => {
    if (currentMessage.trim() !== '') {
      const myRole = mySymbol === 'Spectator' ? 'spectator' : 'player';
      socket.emit('send_message', { 
        room: roomCode, username: playerData, text: currentMessage.trim(), chat_type: myRole 
      });
      setCurrentMessage(''); 
    }
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

    const newWinner = calculateWinner(newBoard);
    let newScores = { ...scores };
    if (newWinner) newScores[newWinner] += 1;

    setBoard(newBoard); setXIsNext(!xIsNext); setXMoves(newXMoves); setOMoves(newOMoves);
    if (newWinner) setScores(newScores); 
    
    socket.emit('move', { room: roomCode, board: newBoard, xIsNext: !xIsNext, xMoves: newXMoves, oMoves: newOMoves, scores: newScores });
  }

  if (conflictUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center text-white p-4 py-8">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          <div className="mb-8">
            <h2 className="text-4xl font-extrabold mb-4">Oops! 🚨</h2>
            <p className="text-indigo-200">Ești deja conectat cu contul <span className="font-bold text-white">{conflictUser.username}</span> pe un alt dispozitiv.</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => handleAuth('login', true)} className="w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 py-4 rounded-xl font-bold shadow-lg">Switch here (Închide cealaltă sesiune)</button>
            <button onClick={() => { setConflictUser(null); setUsername(''); setPassword(''); }} className="w-full bg-white/10 hover:bg-white/20 py-4 rounded-xl font-bold border border-white/20">Login with another account</button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoggedIn && inRoom) {
    const winner = calculateWinner(board);
    const isDraw = !winner && board.every(square => square !== null); 
    const currentTurnSymbol = xIsNext ? 'X' : 'O';
    const currentTurnName = players[currentTurnSymbol] || currentTurnSymbol;
    const isRoomFull = players.X && players.O;
    const oldestXMove = xMoves.length === 3 ? xMoves[0] : null;
    const oldestOMove = oMoves.length === 3 ? oMoves[0] : null;

    let statusMessage;
    if (winner) {
      statusMessage = `🎉 Câștigător: ${players[winner] || winner}!`;
    } else if (isDraw) {
      statusMessage = "🤝 Remiză!";
    } else if (!isRoomFull) {
      statusMessage = "⏳ Așteptăm adversarul...";
    } else {
      if (mySymbol === 'Spectator') {
        statusMessage = `Rândul lui ${currentTurnName}`;
      } else {
        statusMessage = mySymbol === currentTurnSymbol ? "E rândul tău!" : `Așteaptă... e rândul lui ${currentTurnName}`;
      }
    }

    const myRole = mySymbol === 'Spectator' ? 'spectator' : 'player';
    const visibleMessages = messages.filter(msg => msg.chat_type === myRole);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4 py-8">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* COLOANA 1: SCOR */}
          <div className="lg:col-span-3 bg-white/10 backdrop-blur-lg p-6 rounded-3xl border border-white/20 shadow-2xl flex flex-col h-full">
            <h2 className="text-2xl font-extrabold mb-6 text-center text-indigo-200">Tabelă Scor</h2>
            
            <div className="flex flex-col gap-4 flex-1">
              <div className={`p-4 rounded-2xl flex justify-between items-center transition-all ${mySymbol === 'X' ? 'bg-blue-500/20 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'bg-white/5 border border-white/10'}`}>
                <div className="flex flex-col">
                  <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Jucător (X)</span>
                  <span className="font-bold text-lg truncate max-w-[120px]">{players.X || 'Așteptare...'}</span>
                </div>
                <span className="text-4xl font-black text-blue-400">{scores.X}</span>
              </div>
              <div className={`p-4 rounded-2xl flex justify-between items-center transition-all ${mySymbol === 'O' ? 'bg-red-500/20 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-white/5 border border-white/10'}`}>
                <div className="flex flex-col">
                  <span className="text-xs text-indigo-300 font-bold uppercase tracking-wider">Jucător (O)</span>
                  <span className="font-bold text-lg truncate max-w-[120px]">{players.O || 'Așteptare...'}</span>
                </div>
                <span className="text-4xl font-black text-red-400">{scores.O}</span>
              </div>
              
              <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-sm text-indigo-300 font-bold uppercase tracking-wider">👁️ Spectatori</span>
                <span className="font-bold text-2xl text-cyan-400">{players.spectatorCount || 0}</span>
              </div>
            </div>

            <button onClick={handleLeaveRoom} className="mt-8 w-full bg-red-500/10 hover:bg-red-500/30 text-red-300 py-3 rounded-xl font-bold transition-all border border-red-500/20 active:scale-95">Ieși din cameră</button>
          </div>

          {/* COLOANA 2: TABLA DE JOC */}
          <div className={`lg:col-span-6 bg-white/10 backdrop-blur-lg p-6 sm:p-8 rounded-3xl shadow-2xl text-center transition-all duration-500 border-4 flex flex-col justify-center h-full ${isRoomFull ? 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-gray-400/30 border-dashed'}`}>
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
              <h1 className="text-xl font-bold">{playerData} <span className="text-sm font-normal opacity-80">(Tu ești {mySymbol})</span></h1>
              <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm font-mono font-bold tracking-widest">CAMERĂ: {roomCode}</span>
            </div>
            <p className={`mb-6 text-2xl font-bold ${winner ? 'text-green-400 animate-bounce' : isRoomFull ? 'text-indigo-200' : 'text-gray-400 animate-pulse'}`}>{statusMessage}</p>
            
            <div className="grid grid-cols-3 gap-2 sm:gap-4 w-full aspect-square p-4 sm:p-6 bg-white/5 rounded-2xl border border-white/10 mx-auto max-w-[450px]">
              {board.map((value, index) => {
                const isOldest = (value === 'X' && index === oldestXMove) || (value === 'O' && index === oldestOMove);
                return (
                  <button 
                    key={index} onClick={() => !winner && isRoomFull && handleSquareClick(index)} 
                    className={`bg-white/10 rounded-2xl flex items-center justify-center text-5xl sm:text-7xl font-black transition-all ${(winner || mySymbol !== currentTurnSymbol || value || !isRoomFull) ? 'cursor-not-allowed opacity-80' : 'hover:bg-white/20 active:scale-95'}`}
                  >
                    {value === 'X' ? <span className={`text-blue-400 transition-opacity duration-300 ${isOldest && !winner ? 'opacity-30 animate-pulse' : ''}`}>X</span> : value === 'O' ? <span className={`text-red-400 transition-opacity duration-300 ${isOldest && !winner ? 'opacity-30 animate-pulse' : ''}`}>O</span> : ''}
                  </button>
                )
              })}
            </div>

            {(winner || isDraw) && mySymbol !== 'Spectator' && (
              <button onClick={() => { 
                  const emptyBoard = Array(9).fill(null); const nextGameXStarts = !xStartedThisGame; 
                  setBoard(emptyBoard); setXIsNext(nextGameXStarts); setXMoves([]); setOMoves([]); setXStartedThisGame(nextGameXStarts);
                  socket.emit('move', { room: roomCode, board: emptyBoard, xIsNext: nextGameXStarts, xMoves: [], oMoves: [], xStarted: nextGameXStarts, scores: scores });
                }} className="mt-6 w-full max-w-[450px] mx-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 py-4 rounded-xl font-bold text-lg shadow-lg transform transition active:scale-95"
              >Joacă din nou (Schimbă rândul)</button>
            )}
          </div>

          {/* COLOANA 3: CHAT */}
          <div className="lg:col-span-3 bg-white/10 backdrop-blur-lg p-6 rounded-3xl border border-white/20 shadow-2xl flex flex-col h-full min-h-[500px]">
            <h2 className="text-2xl font-extrabold mb-4 text-center text-indigo-200">
              Live Chat <span className="block text-sm font-normal opacity-70">{myRole === 'spectator' ? '(Doar Spectatori)' : '(Doar Jucători)'}</span>
            </h2>
            
            <div className="bg-black/20 rounded-xl p-4 flex-1 overflow-y-auto flex flex-col gap-3 mb-4 shadow-inner text-left [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {visibleMessages.length === 0 ? (
                <p className="text-center text-white/30 text-sm mt-auto mb-auto">Niciun mesaj încă în chat-ul {myRole === 'spectator' ? 'spectatorilor' : 'jucătorilor'}.</p>
              ) : (
                visibleMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.username === playerData ? 'items-end' : 'items-start'}`}>
                    <span className="text-[11px] font-bold text-indigo-300 mb-1 px-1">{msg.username}</span>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] break-words shadow-md ${msg.username === playerData ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none' : 'bg-white/15 text-white rounded-tl-none border border-white/10'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="flex gap-2 shrink-0">
              <input 
                type="text" 
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Scrie mesaj..." 
                className="flex-1 p-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all text-sm placeholder:text-white/30"
              />
              <button 
                onClick={handleSendMessage}
                className="bg-purple-600 hover:bg-purple-500 px-4 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg flex items-center justify-center"
              >
                ➔
              </button>
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ECRANUL 2: LOBBY
  if (isLoggedIn && !inRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex flex-col items-center justify-center text-white p-4 py-8">
        <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md text-center">
          <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
            <h1 className="text-2xl font-extrabold">Lobby</h1>
            <button onClick={() => { setIsLoggedIn(false); setPlayerData(null); socket.disconnect(); }} className="bg-red-500/20 hover:bg-red-500/40 text-red-300 px-4 py-2 rounded-lg text-sm font-bold transition-all">Deconectare</button>
          </div>
          <p className="text-indigo-200 mb-8">Salut, {playerData}! Introduceți un cod de cameră pentru a continua.</p>
          <div className="space-y-4">
            <input type="text" placeholder="Ex: BGG2026" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white/10 transition-all uppercase text-center font-bold tracking-widest" value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} />
            
            <div className="flex gap-4 pt-2">
              <button 
                onClick={() => handleJoinRoom('player')} 
                disabled={isRoomFullLobby}
                className={`w-full py-4 rounded-xl font-bold text-sm shadow-lg transition-all ${isRoomFullLobby ? 'bg-gray-500/30 text-gray-400 cursor-not-allowed border border-gray-500/30' : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500'}`}
              >
                {isRoomFullLobby ? 'Jucători Pli' : 'Intră ca Jucător'}
              </button>
              
              <button 
                onClick={() => handleJoinRoom('spectator')} 
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 py-4 rounded-xl font-bold text-sm shadow-lg transition-all"
              >
                Intră Spectator
              </button>
            </div>
            
          </div>
        </div>
      </div>
    )
  }

  // ECRANUL 1: AUTENTIFICARE
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-indigo-900 flex items-center justify-center text-white p-4 py-8">
      <div className="bg-white/10 backdrop-blur-lg p-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md">
        <div className="text-center mb-8"><h1 className="text-4xl font-extrabold tracking-tight mb-2">Tic-Tac-Toe</h1><p className="text-indigo-200">Proiect Erasmus 2026</p></div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2 ml-1">Nume Jucător</label>
            <input type="text" placeholder="Ex: Oaia Verde" className="w-full p-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-indigo-200 mb-2 ml-1">Parolă</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                className="w-full p-4 pr-12 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-white/30" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 transition-colors"
                title={showPassword ? "Ascunde Parola" : "Arată Parola"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button onClick={() => handleAuth('login')} className="w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold text-md border border-white/20 transition-all active:scale-95">Logare</button>
            <button onClick={() => handleAuth('register')} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 py-3 rounded-xl font-bold text-md transition-all active:scale-95">Creare Cont</button>
          </div>
        </div>
        {message && <div className="mt-6 p-3 rounded-lg text-center text-sm font-medium bg-red-500/20 text-red-200">{message}</div>}
      </div>
    </div>
  )
}

export default App