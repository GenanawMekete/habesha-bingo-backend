const { Card, Game } = require('../config/database');
const { GAME_CONFIG } = require('../config/constants');

class GameService {
  // Generate BINGO cards
  async generateCards(count) {
    const cards = [];
    
    for (let i = 0; i < count; i++) {
      const card = await this.generateCard();
      cards.push(card);
    }
    
    return cards;
  }

  async generateCard() {
    const columns = {
      B: this.generateColumn(1, 15, 5),
      I: this.generateColumn(16, 30, 5),
      N: this.generateColumn(31, 45, 5),
      G: this.generateColumn(46, 60, 5),
      O: this.generateColumn(61, 75, 5)
    };

    // Center square is FREE
    columns.N[2] = 'FREE';

    // Create 5x5 grid
    const grid = [];
    for (let i = 0; i < 5; i++) {
      grid.push([
        columns.B[i],
        columns.I[i],
        columns.N[i],
        columns.G[i],
        columns.O[i]
      ]);
    }

    const cardId = `CARD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const card = new Card({
      cardId,
      numbers: grid,
      theme: this.getRandomTheme()
    });

    await card.save();
    return card;
  }

  generateColumn(min, max, count) {
    const numbers = new Set();
    while (numbers.size < count) {
      numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
    }
    return Array.from(numbers);
  }

  getRandomTheme() {
    const themes = ['classic', 'ocean', 'forest', 'space', 'neon', 'retro'];
    return themes[Math.floor(Math.random() * themes.length)];
  }

  // Check for winning patterns
  checkWinningPatterns(cardNumbers, drawnNumbers) {
    const patterns = [];
    const drawnSet = new Set(drawnNumbers);
    
    // Convert card to flat array (excluding FREE)
    const flatCard = cardNumbers.flat().filter(num => num !== 'FREE');
    
    // Check full house
    const matchedNumbers = flatCard.filter(num => drawnSet.has(num));
    if (matchedNumbers.length === flatCard.length) {
      patterns.push('full-house');
    }
    
    // Check lines (rows, columns, diagonals)
    for (let i = 0; i < 5; i++) {
      // Check row
      const row = cardNumbers[i];
      if (row.every((num, idx) => num === 'FREE' || drawnSet.has(num) || (i === 2 && idx === 2))) {
        patterns.push(`row-${i + 1}`);
      }
      
      // Check column
      const col = cardNumbers.map(row => row[i]);
      if (col.every((num, idx) => num === 'FREE' || drawnSet.has(num) || (idx === 2 && i === 2))) {
        patterns.push(`col-${i + 1}`);
      }
    }
    
    // Check diagonals
    const diag1 = [0, 1, 2, 3, 4].map(i => cardNumbers[i][i]);
    const diag2 = [0, 1, 2, 3, 4].map(i => cardNumbers[i][4 - i]);
    
    if (diag1.every((num, idx) => num === 'FREE' || drawnSet.has(num) || idx === 2)) {
      patterns.push('diagonal-1');
    }
    
    if (diag2.every((num, idx) => num === 'FREE' || drawnSet.has(num) || idx === 2)) {
      patterns.push('diagonal-2');
    }
    
    // Check four corners
    const corners = [
      cardNumbers[0][0],
      cardNumbers[0][4],
      cardNumbers[4][0],
      cardNumbers[4][4]
    ];
    
    if (corners.every(num => num === 'FREE' || drawnSet.has(num))) {
      patterns.push('four-corners');
    }
    
    return patterns;
  }

  // Create a new game
  async createGame(gameData) {
    const gameId = `GAME_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const game = new Game({
      gameId,
      name: gameData.name || `BINGO Game ${new Date().toLocaleDateString()}`,
      maxPlayers: gameData.maxPlayers || 100,
      entryFee: gameData.entryFee || 10,
      prizePool: gameData.prizePool || (gameData.entryFee * gameData.maxPlayers * 0.8), // 80% to prize pool
      startTime: gameData.startTime || new Date(Date.now() + 3600000), // 1 hour from now
      endTime: gameData.endTime || new Date(Date.now() + 86400000) // 24 hours from now
    });

    await game.save();
    return game;
  }
}

module.exports = new GameService();
