from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from models import db, User
from flask_socketio import SocketIO, join_room, leave_room, emit
from flask_cors import CORS

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*")

with app.app_context():
    db.create_all()

# --- MEMORIE PENTRU SESIUNI ---
rooms_data = {}
active_users = {} # NOU: Aici ținem minte cine e deja conectat (User -> Socket ID)

@app.route('/')
def home():
    return {"message": "Server online!"}

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password: return jsonify({"error": "Numele și parola sunt obligatorii!"}), 400
    if User.query.filter_by(username=username).first(): return jsonify({"error": "Acest nume de utilizator există deja!"}), 409
    
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "Utilizator creat cu succes!", "user_id": new_user.id}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    force = data.get('force', False) # Verificăm dacă user-ul a dat click pe "Switch here"
    
    if not username or not password: return jsonify({"error": "Numele și parola sunt obligatorii!"}), 400
    user = User.query.filter_by(username=username).first()
    
    if user and check_password_hash(user.password, password):
        # Dacă user-ul e conectat și NU a apăsat forțare, returnăm eroare
        if username in active_users and not force:
            return jsonify({"error": "already_logged_in"}), 409
            
        return jsonify({"message": f"Bine ai revenit, {username}!", "user_id": user.id}), 200
    else:
        return jsonify({"error": "Nume de utilizator sau parolă incorectă!"}), 401

# --- LOGICĂ SOCKET.IO MULTIPLAYER ---

@socketio.on('register_user')
def on_register(data):
    username = data['username']
    # Dacă utilizatorul e deja conectat, îl dăm afară pe cel vechi
    if username in active_users:
        old_sid = active_users[username]
        if old_sid != request.sid:
            emit('force_logout', to=old_sid)
            # Dacă cel vechi era într-un meci, îi eliberăm scaunul ca să nu devină fantomă
            for room, players in list(rooms_data.items()):
                if players['X'] == username:
                    players['X'] = None
                    emit('room_players', players, to=room)
                elif players['O'] == username:
                    players['O'] = None
                    emit('room_players', players, to=room)
                if players['X'] is None and players['O'] is None:
                    del rooms_data[room]

    active_users[username] = request.sid # Înregistrăm noul dispozitiv

@socketio.on('join')
def on_join(data):
    room = data['room']
    username = data['username']
    join_room(room)
    
    if room not in rooms_data:
        rooms_data[room] = {'X': username, 'O': None}
        my_symbol = 'X'
    else:
        if rooms_data[room]['O'] is None and rooms_data[room]['X'] != username:
            rooms_data[room]['O'] = username
            my_symbol = 'O'
        elif rooms_data[room]['X'] == username:
            my_symbol = 'X'
        elif rooms_data[room]['O'] == username:
            my_symbol = 'O'
        else:
            my_symbol = 'Spectator'

    emit('assign_symbol', {'symbol': my_symbol}, to=request.sid)
    emit('room_players', rooms_data[room], to=room)

@socketio.on('leave')
def on_leave(data):
    room = data['room']
    username = data['username']
    leave_room(room)
    if room in rooms_data:
        if rooms_data[room]['X'] == username: rooms_data[room]['X'] = None
        elif rooms_data[room]['O'] == username: rooms_data[room]['O'] = None
        emit('room_players', rooms_data[room], to=room)
        if rooms_data[room]['X'] is None and rooms_data[room]['O'] is None:
            del rooms_data[room]

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    disconnected_user = None
    # Îl ștergem din lista globală la deconectare fizică (ex: închide browser-ul)
    for user, user_sid in list(active_users.items()):
        if user_sid == sid:
            disconnected_user = user
            del active_users[user]
            break

    if disconnected_user:
        for room, players in list(rooms_data.items()):
            if players['X'] == disconnected_user:
                players['X'] = None
                emit('room_players', players, to=room)
            elif players['O'] == disconnected_user:
                players['O'] = None
                emit('room_players', players, to=room)
            if players['X'] is None and players['O'] is None:
                del rooms_data[room]

@socketio.on('move')
def on_move(data):
    room = data['room']
    emit('update_board', data, to=room)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)