from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict, List, Optional
import sqlite3
import json
import random
import asyncio
import secrets
from datetime import datetime, timedelta
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Geez Bingo API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
def init_db():
    conn = sqlite3.connect('bingo.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE,
            username TEXT,
            wallet INTEGER DEFAULT 200,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Games table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT DEFAULT 'waiting',
            pot_amount INTEGER DEFAULT 0,
            entry_fee INTEGER DEFAULT 10,
            win_pattern TEXT DEFAULT 'line',
            current_number TEXT,
            numbers_called TEXT DEFAULT '[]',
            started_at DATETIME,
            ended_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Players table (game participants)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER,
            user_id INTEGER,
            card_number INTEGER,
            card_data TEXT,
            marked_numbers TEXT DEFAULT '[]',
            has_won BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (game_id) REFERENCES games (id),
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            type TEXT, -- 'stake', 'win', 'refund'
            amount INTEGER,
            game_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (game_id) REFERENCES games (id)
        )
    ''')
    
    conn.commit()
    conn.close()

init_db()

# Pydantic models
class UserCreate(BaseModel):
    telegram_id: int
    username: str

class GameCreate(BaseModel):
    entry_fee: int = 10
    win_pattern: str = "line"

class JoinGame(BaseModel):
    user_id: int
    card_number: int

class WebAppData(BaseModel):
    user_id: int
    session_id: str

# Connection manager for WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.game_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: int):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message)
            except:
                self.disconnect(user_id)

    async def broadcast_to_game(self, message: str, game_id: int):
        if game_id in self.game_connections:
            disconnected = []
            for websocket in self.game_connections[game_id]:
                try:
                    await websocket.send_text(message)
                except:
                    disconnected.append(websocket)
            for websocket in disconnected:
                self.game_connections[game_id].remove(websocket)

manager = ConnectionManager()

# Database helpers
def get_db():
    conn = sqlite3.connect('bingo.db')
    conn.row_factory = sqlite3.Row
    return conn

def create_user(telegram_id: int, username: str):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute(
        "INSERT OR IGNORE INTO users (telegram_id, username) VALUES (?, ?)",
        (telegram_id, username)
    )
    
    if cursor.rowcount == 0:
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
    else:
        user_id = cursor.lastrowid
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
    
    conn.commit()
    conn.close()
    return dict(user) if user else None

def get_user(telegram_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def update_wallet(user_id: int, amount: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET wallet = wallet + ? WHERE id = ?", (amount, user_id))
    conn.commit()
    conn.close()

def create_transaction(user_id: int, type: str, amount: int, game_id: int = None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO transactions (user_id, type, amount, game_id) VALUES (?, ?, ?, ?)",
        (user_id, type, amount, game_id)
    )
    conn.commit()
    conn.close()

# Game engine
class BingoGameEngine:
    def __init__(self):
        self.available_numbers = self.generate_all_numbers()
        self.active_game = None

    def generate_all_numbers(self):
        numbers = []
        ranges = {'B': (1,15), 'I': (16,30), 'N': (31,45), 'G': (46,60), 'O': (61,75)}
        for letter, (start, end) in ranges.items():
            for num in range(start, end + 1):
                numbers.append(f"{letter}-{num}")
        return numbers

    def generate_card(self, card_number: int):
        random.seed(card_number)
        card = {}
        ranges = {'B': (1,15), 'I': (16,30), 'N': (31,45), 'G': (46,60), 'O': (61,75)}
        
        for letter in 'BINGO':
            numbers = random.sample(range(ranges[letter][0], ranges[letter][1] + 1), 5)
            card[letter] = numbers
        
        card['N'][2] = "FREE"
        random.seed()
        return card

    def check_win(self, card_data: dict, marked_numbers: list, win_pattern: str):
        card = card_data
        marked = set(marked_numbers)
        
        if win_pattern == "line":
            return self._check_line_win(card, marked)
        elif win_pattern == "full_house":
            return self._check_full_house(card, marked)
        elif win_pattern == "four_corners":
            return self._check_four_corners(card, marked)
        elif win_pattern == "X":
            return self._check_x_pattern(card, marked)
        return False

    def _check_line_win(self, card, marked):
        # Check rows
        for i in range(5):
            if all(self._is_marked_or_free(card[letter][i], letter, marked) for letter in 'BINGO'):
                return True
        
        # Check columns
        for letter in 'BINGO':
            if all(self._is_marked_or_free(card[letter][i], letter, marked) for i in range(5)):
                return True
        
        # Check diagonals
        if all(self._is_marked_or_free(card[letter][i], letter, marked) for i, letter in enumerate('BINGO')):
            return True
        if all(self._is_marked_or_free(card[letter][4-i], letter, marked) for i, letter in enumerate('BINGO')):
            return True
        
        return False

    def _check_full_house(self, card, marked):
        for letter in 'BINGO':
            for i in range(5):
                if not self._is_marked_or_free(card[letter][i], letter, marked):
                    return False
        return True

    def _check_four_corners(self, card, marked):
        corners = [('B', 0), ('O', 0), ('B', 4), ('O', 4)]
        return all(self._is_marked_or_free(card[letter][pos], letter, marked) for letter, pos in corners)

    def _check_x_pattern(self, card, marked):
        diag1 = all(self._is_marked_or_free(card[letter][i], letter, marked) for i, letter in enumerate('BINGO'))
        diag2 = all(self._is_marked_or_free(card[letter][4-i], letter, marked) for i, letter in enumerate('BINGO'))
        return diag1 and diag2

    def _is_marked_or_free(self, num, letter, marked):
        return num == "FREE" or f"{letter}-{num}" in marked

game_engine = BingoGameEngine()

# API Routes
@app.get("/")
async def root():
    return {"message": "Geez Bingo API", "status": "running"}

@app.post("/api/users")
async def create_user_endpoint(user_data: UserCreate):
    user = create_user(user_data.telegram_id, user_data.username)
    if user:
        return user
    raise HTTPException(status_code=400, detail="User already exists")

@app.get("/api/users/{telegram_id}")
async def get_user_endpoint(telegram_id: int):
    user = get_user(telegram_id)
    if user:
        return user
    raise HTTPException(status_code=404, detail="User not found")

@app.get("/api/games/current")
async def get_current_game():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM games WHERE status = 'active' ORDER BY id DESC LIMIT 1")
    game = cursor.fetchone()
    conn.close()
    
    if game:
        return dict(game)
    
    # Create new game if none exists
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO games (status, pot_amount, entry_fee) VALUES ('waiting', 0, 10)"
    )
    game_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"id": game_id, "status": "waiting", "pot_amount": 0, "entry_fee": 10}

@app.post("/api/games/{game_id}/join")
async def join_game(game_id: int, join_data: JoinGame):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if user exists
    cursor.execute("SELECT * FROM users WHERE id = ?", (join_data.user_id,))
    user = cursor.fetchone()
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if game exists and is waiting
    cursor.execute("SELECT * FROM games WHERE id = ? AND status = 'waiting'", (game_id,))
    game = cursor.fetchone()
    if not game:
        conn.close()
        raise HTTPException(status_code=400, detail="Game not available")
    
    # Check if user has enough funds
    if user['wallet'] < game['entry_fee']:
        conn.close()
        raise HTTPException(status_code=400, detail="Insufficient funds")
    
    # Check if card is available (simple check)
    cursor.execute("SELECT * FROM players WHERE game_id = ? AND card_number = ?", (game_id, join_data.card_number))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Card already taken")
    
    # Generate card
    card_data = game_engine.generate_card(join_data.card_number)
    
    # Deduct entry fee and update pot
    cursor.execute("UPDATE users SET wallet = wallet - ? WHERE id = ?", (game['entry_fee'], join_data.user_id))
    cursor.execute("UPDATE games SET pot_amount = pot_amount + ? WHERE id = ?", (game['entry_fee'], game_id))
    
    # Add player to game
    cursor.execute(
        "INSERT INTO players (game_id, user_id, card_number, card_data) VALUES (?, ?, ?, ?)",
        (game_id, join_data.user_id, join_data.card_number, json.dumps(card_data))
    )
    
    # Record transaction
    cursor.execute(
        "INSERT INTO transactions (user_id, type, amount, game_id) VALUES (?, 'stake', ?, ?)",
        (join_data.user_id, game['entry_fee'], game_id)
    )
    
    conn.commit()
    
    # Get updated game info
    cursor.execute("SELECT * FROM games WHERE id = ?", (game_id,))
    updated_game = dict(cursor.fetchone())
    conn.close()
    
    # Broadcast update
    await manager.broadcast_to_game(
        json.dumps({
            "type": "player_joined",
            "game_id": game_id,
            "player_count": await get_player_count(game_id),
            "pot_amount": updated_game['pot_amount']
        }),
        game_id
    )
    
    return {
        "success": True,
        "game": updated_game,
        "card": card_data
    }

@app.post("/api/games/{game_id}/start")
async def start_game(game_id: int):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if game exists and has players
    cursor.execute("SELECT COUNT(*) as count FROM players WHERE game_id = ?", (game_id,))
    player_count = cursor.fetchone()['count']
    
    if player_count < 1:
        conn.close()
        raise HTTPException(status_code=400, detail="Need at least 1 player")
    
    # Update game status
    cursor.execute(
        "UPDATE games SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE id = ?",
        (game_id,)
    )
    conn.commit()
    conn.close()
    
    # Start auto-calling numbers
    asyncio.create_task(auto_call_numbers(game_id))
    
    # Broadcast game start
    await manager.broadcast_to_game(
        json.dumps({
            "type": "game_started",
            "game_id": game_id
        }),
        game_id
    )
    
    return {"success": True, "message": "Game started"}

@app.get("/api/games/{game_id}/players")
async def get_game_players(game_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT p.*, u.username, u.telegram_id 
        FROM players p 
        JOIN users u ON p.user_id = u.id 
        WHERE p.game_id = ?
    ''', (game_id,))
    players = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return players

async def get_player_count(game_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM players WHERE game_id = ?", (game_id,))
    count = cursor.fetchone()['count']
    conn.close()
    return count

async def auto_call_numbers(game_id: int):
    """Automatically call numbers for a game"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get game info
    cursor.execute("SELECT * FROM games WHERE id = ?", (game_id,))
    game = dict(cursor.fetchone())
    
    if game['status'] != 'active':
        conn.close()
        return
    
    called_numbers = json.loads(game['numbers_called'] or '[]')
    available_numbers = [n for n in game_engine.available_numbers if n not in called_numbers]
    
    while available_numbers and game['status'] == 'active':
        # Call next number
        called_number = random.choice(available_numbers)
        called_numbers.append(called_number)
        
        # Update game
        cursor.execute(
            "UPDATE games SET current_number = ?, numbers_called = ? WHERE id = ?",
            (called_number, json.dumps(called_numbers), game_id)
        )
        conn.commit()
        
        # Update player marked numbers
        cursor.execute("SELECT * FROM players WHERE game_id = ?", (game_id,))
        players = [dict(row) for row in cursor.fetchall()]
        
        for player in players:
            card_data = json.loads(player['card_data'])
            marked_numbers = json.loads(player['marked_numbers'] or '[]')
            
            letter, num = called_number.split('-')
            num = int(num)
            
            if num in card_data.get(letter, []):
                marked_numbers.append(called_number)
                cursor.execute(
                    "UPDATE players SET marked_numbers = ? WHERE id = ?",
                    (json.dumps(marked_numbers), player['id'])
                )
                
                # Check for win
                if game_engine.check_win(card_data, marked_numbers, game['win_pattern']):
                    await declare_winner(game_id, player['id'])
                    conn.commit()
                    conn.close()
                    return
        
        conn.commit()
        
        # Broadcast number call
        await manager.broadcast_to_game(
            json.dumps({
                "type": "number_called",
                "game_id": game_id,
                "number": called_number,
                "called_count": len(called_numbers)
            }),
            game_id
        )
        
        # Wait before next call
        await asyncio.sleep(10)  # 10 seconds between calls
        
        # Refresh available numbers
        available_numbers = [n for n in game_engine.available_numbers if n not in called_numbers]
        
        # Check game status
        cursor.execute("SELECT status FROM games WHERE id = ?", (game_id,))
        game_status = cursor.fetchone()['status']
        if game_status != 'active':
            break
    
    # End game if no numbers left
    if not available_numbers:
        cursor.execute(
            "UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
            (game_id,)
        )
        conn.commit()
    
    conn.close()

async def declare_winner(game_id: int, player_id: int):
    conn = get_db()
    cursor = conn.cursor()
    
    # Get game and player info
    cursor.execute("SELECT * FROM games WHERE id = ?", (game_id,))
    game = dict(cursor.fetchone())
    
    cursor.execute('''
        SELECT p.*, u.username, u.id as user_id 
        FROM players p 
        JOIN users u ON p.user_id = u.id 
        WHERE p.id = ?
    ''', (player_id,))
    player = dict(cursor.fetchone())
    
    # Mark player as winner
    cursor.execute("UPDATE players SET has_won = TRUE WHERE id = ?", (player_id,))
    
    # Award pot to winner
    cursor.execute("UPDATE users SET wallet = wallet + ? WHERE id = ?", (game['pot_amount'], player['user_id']))
    
    # Record transaction
    cursor.execute(
        "INSERT INTO transactions (user_id, type, amount, game_id) VALUES (?, 'win', ?, ?)",
        (player['user_id'], game['pot_amount'], game_id)
    )
    
    # Update game status
    cursor.execute(
        "UPDATE games SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ?",
        (game_id,)
    )
    
    conn.commit()
    conn.close()
    
    # Broadcast winner
    await manager.broadcast_to_game(
        json.dumps({
            "type": "winner",
            "game_id": game_id,
            "winner": player['username'],
            "pot_amount": game['pot_amount'],
            "card_number": player['card_number']
        }),
        game_id
    )

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
    except WebSocketDisconnect:
        manager.disconnect(user_id)

@app.get("/api/available-cards/{game_id}")
async def get_available_cards(game_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT card_number FROM players WHERE game_id = ?", (game_id,))
    taken_cards = [row['card_number'] for row in cursor.fetchall()]
    conn.close()
    
    all_cards = list(range(145, 545))
    available_cards = [card for card in all_cards if card not in taken_cards]
    
    return {
        "available_cards": available_cards,
        "total_cards": len(available_cards)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
