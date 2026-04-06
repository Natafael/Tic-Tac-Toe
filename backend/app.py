from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash # Adăugat pentru securitate
from config import Config
from models import db, User
from flask_socketio import SocketIO
from flask_cors import CORS

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

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)