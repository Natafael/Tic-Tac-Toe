from flask import Flask
from config import Config
from models import db
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
app.config.from_object(Config)

# Inițializăm baza de date și extensiile
db.init_app(app)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Această secțiune creează tabelele în Postgres automat când pornești serverul
with app.app_context():
    db.create_all()
    print("Tabelele au fost create cu succes în baza de date!")

@app.route('/')
def home():
    return {"message": "Serverul Tic-Tac-Toe este online și baza de date e conectată!"}

if __name__ == '__main__':
    socketio.run(app, debug=True)