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

rooms_data = {}
active_users = {} 

@app.route('/')
def home():
    return {"message": "Server online!"}

# --- Endpoint for checking if a room is full ---
@app.route('/room_status/<room_code>', methods=['GET'])
def room_status(room_code):
    if room_code in rooms_data:
        is_full = rooms_data[room_code]['X'] is not None and rooms_data[room_code]['O'] is not None
        return jsonify({"is_full": is_full})
    return jsonify({"is_full": False})

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password: return jsonify({"error": "Username and password are required!"}), 400
    if User.query.filter_by(username=username).first(): return jsonify({"error": "This username already exists!"}), 409
    
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User created successfully!", "user_id": new_user.id}), 201

@app.route('/login', methods=['POST'])
def login():
    #TODO: DE ADAUGAT VALIDARE
    data = request.json
    username = data.get('username')
    password = data.get('password')
    force = data.get('force', False)
    
    if not username or not password: return jsonify({"error": "Username and password are required!"}), 400
    user = User.query.filter_by(username=username).first()
    
    if user and check_password_hash(user.password, password):
        if username in active_users and not force:
            return jsonify({"error": "already_logged_in"}), 409
        return jsonify({"message": f"Welcome back, {username}!", "user_id": user.id}), 200
    else:
        return jsonify({"error": "Incorrect username or password!"}), 401

# --- Send room's data safely ---
def get_safe_room_data(room):
    return {
        'X': rooms_data[room]['X'],
        'O': rooms_data[room]['O'],
        'spectatorCount': len(rooms_data[room].get('spectators', []))
    }

@socketio.on('register_user')
def on_register(data):
    username = data['username']
    if username in active_users:
        old_sid = active_users[username]
        if old_sid != request.sid:
            emit('force_logout', to=old_sid)
            for room, players in list(rooms_data.items()):
                changed = False
                if players['X'] == username: players['X'] = None; changed = True
                elif players['O'] == username: players['O'] = None; changed = True
                elif username in players.get('spectators', []): players['spectators'].remove(username); changed = True
                
                if changed:
                    emit('room_players', get_safe_room_data(room), to=room)
                    if players['X'] is None and players['O'] is None and len(players.get('spectators', [])) == 0:
                        del rooms_data[room]

    active_users[username] = request.sid 

@socketio.on('join')
def on_join(data):
    room = data['room']
    username = data['username']
    role_request = data.get('role', 'player') # We get the desired role (player/spectator) from the client
    join_room(room)
    
    if room not in rooms_data:
        rooms_data[room] = {'X': None, 'O': None, 'spectators': []}

    my_symbol = 'Spectator'
    
    # NOU: Logica de alocare cu spectatori
    if role_request == 'player':
        if rooms_data[room]['X'] is None and rooms_data[room]['O'] != username:
            rooms_data[room]['X'] = username
            my_symbol = 'X'
        elif rooms_data[room]['O'] is None and rooms_data[room]['X'] != username:
            rooms_data[room]['O'] = username
            my_symbol = 'O'
        elif rooms_data[room]['X'] == username: my_symbol = 'X'
        elif rooms_data[room]['O'] == username: my_symbol = 'O'
        else:
            if username not in rooms_data[room]['spectators']: rooms_data[room]['spectators'].append(username)
    else:
        # If the user wants to be a spectator, we add them to the spectators list if they're not already a player
        if username not in rooms_data[room]['spectators']: rooms_data[room]['spectators'].append(username)

    emit('assign_symbol', {'symbol': my_symbol}, to=request.sid)
    emit('room_players', get_safe_room_data(room), to=room)

@socketio.on('leave')
def on_leave(data):
    room = data['room']
    username = data['username']
    leave_room(room)
    if room in rooms_data:
        if rooms_data[room]['X'] == username: rooms_data[room]['X'] = None
        elif rooms_data[room]['O'] == username: rooms_data[room]['O'] = None
        elif username in rooms_data[room].get('spectators', []): rooms_data[room]['spectators'].remove(username)
        
        emit('room_players', get_safe_room_data(room), to=room)
        if rooms_data[room]['X'] is None and rooms_data[room]['O'] is None and len(rooms_data[room].get('spectators', [])) == 0:
            del rooms_data[room]

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    disconnected_user = None
    for user, user_sid in list(active_users.items()):
        if user_sid == sid:
            disconnected_user = user
            del active_users[user]
            break

    if disconnected_user:
        for room, players in list(rooms_data.items()):
            changed = False
            if players['X'] == disconnected_user: players['X'] = None; changed = True
            elif players['O'] == disconnected_user: players['O'] = None; changed = True
            elif disconnected_user in players.get('spectators', []): players['spectators'].remove(disconnected_user); changed = True
            
            if changed:
                emit('room_players', get_safe_room_data(room), to=room)
                if players['X'] is None and players['O'] is None and len(players.get('spectators', [])) == 0:
                    del rooms_data[room]

@socketio.on('move')
def on_move(data):
    room = data['room']
    emit('update_board', data, to=room)

@socketio.on('send_message')
def handle_send_message(data):
    room = data['room']
    username = data['username']
    text = data['text']
    chat_type = data.get('chat_type', 'player') # We get the chat type (player/spectator) from the client
    emit('receive_message', {'username': username, 'text': text, 'chat_type': chat_type}, to=room)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)