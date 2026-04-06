from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash # Adăugat pentru securitate
from config import Config
from models import db, User
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_socketio import join_room, leave_room, emit

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

with app.app_context():
    db.create_all()
    print("Tabelele au fost create cu succes în baza de date!")

@app.route('/')
def home():
    return {"message": "Serverul Tic-Tac-Toe este online și baza de date e conectată!"}

# --- RUTA DE ÎNREGISTRARE ---
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password') # Acum cerem și parola
    
    if not username or not password:
        return jsonify({"error": "Numele și parola sunt obligatorii!"}), 400
    
    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({"error": "Acest nume de utilizator există deja!"}), 409
    
    # Hash-uim parola pentru a nu o salva în clar (best practice)
    hashed_password = generate_password_hash(password)
    
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    
    return jsonify({"message": "Utilizator creat cu succes!", "user_id": new_user.id}), 201

# --- RUTA DE LOGARE ---
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Numele și parola sunt obligatorii!"}), 400
        
    user = User.query.filter_by(username=username).first()
    
    # Verificăm dacă userul există și dacă parola corespunde
    if user and check_password_hash(user.password, password):
        return jsonify({"message": f"Bine ai revenit, {username}!", "user_id": user.id}), 200
    else:
        return jsonify({"error": "Nume de utilizator sau parolă incorectă!"}), 401

# --- LOGICA MULTIPLAYER (SOCKET.IO) ---
rooms_data = {}

@socketio.on('join')
def on_join(data):
    room = data['room']
    username = data['username']
    join_room(room)
    
    # Dacă camera nu există încă, o creăm și primul jucător devine X
    if room not in rooms_data:
        rooms_data[room] = {'X': username, 'O': None}
        my_symbol = 'X'
    else:
        # Dacă există camera, dar locul lui O e liber
        if rooms_data[room]['O'] is None and rooms_data[room]['X'] != username:
            rooms_data[room]['O'] = username
            my_symbol = 'O'
        # Dacă jucătorul a dat refresh la pagină, îi dăm simbolul înapoi
        elif rooms_data[room]['X'] == username:
            my_symbol = 'X'
        elif rooms_data[room]['O'] == username:
            my_symbol = 'O'
        else:
            my_symbol = 'Spectator' # Al treilea om care intră e spectator

    # Îi spunem DOAR persoanei care abia a intrat ce simbol a primit (folosind request.sid)
    emit('assign_symbol', {'symbol': my_symbol}, to=request.sid)
    
    # Anunțăm PE TOATĂ LUMEA din cameră cine sunt jucătorii ca să le afișăm numele
    emit('room_players', rooms_data[room], to=room)

@socketio.on('move')
def on_move(data):
    room = data['room']
    emit('update_board', data, to=room)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)