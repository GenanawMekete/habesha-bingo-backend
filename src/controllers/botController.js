const User = require('../models/User');

class BotController {

async handleCommand(req, res) {
  try {
    const { message } = req.body;
    
    if (!message || !message.text) return res.sendStatus(200);
    
    const chatId = message.chat.id;
    const text = message.text.toLowerCase();
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    let response = '';
    
    // Map commands to functions
    switch(true) {
      case text.startsWith('/start'):
        response = this.handleStart(user);
        break;
      case text.startsWith('/register'):
        response = await this.handleRegister(chatId, user);
        break;
      case text.startsWith('/play'):
        response = this.handlePlay();
        break;
      case text.startsWith('/deposit'):
        response = this.handleDeposit();
        break;
      case text.startsWith('/balance'):
        response = await this.handleBalance(user);
        break;
      case text.startsWith('/withdraw'):
        response = this.handleWithdraw(user);
        break;
      case text.startsWith('/transfer'):
        response = this.handleTransfer(text);
        break;
      case text.startsWith('/instruction'):
        response = this.handleInstruction();
        break;
      case text.startsWith('/support'):
        response = this.handleSupport();
        break;
      case text.startsWith('/invite'):
        response = this.handleInvite(chatId);
        break;
      default:
        response = this.handleDefault();
    }
    
    await this.sendMessage(chatId, response);
    res.sendStatus(200);
    
  } catch (error) {
    console.error('Command error:', error);
    res.sendStatus(200);
  }
}
  // Handle bot commands
  async handleCommand(req, res) {
    try {
      const { message } = req.body;
      
      if (!message || !message.text) {
        return res.sendStatus(200);
      }

      const chatId = message.chat.id;
      const text = message.text.toLowerCase();
      
      let response = '';
      
      // Handle commands
      if (text === '/start') {
        response = `🎮 Welcome to Habesha BINGO!\n\n` +
          `Play exciting BINGO games with friends and win prizes!\n\n` +
          `🎯 Features:\n` +
          `• Multiple cards (1-20 per game)\n` +
          `• Smart discounts (up to 30% off)\n` +
          `• Real-time multiplayer\n` +
          `• Daily bonuses\n\n` +
          `Click the "Play BINGO" button below to start!`;
          
      } else if (text === '/play') {
        response = `🎲 To play BINGO:\n\n` +
          `1. Click the "Play BINGO" button\n` +
          `2. Select your cards (1-20)\n` +
          `3. Join a game room\n` +
          `4. Wait for numbers to be drawn\n` +
          `5. Mark your cards and WIN!`;
          
      } else if (text === '/balance') {
        const user = await User.findOne({ telegramId: chatId.toString() });
        if (user) {
          response = `💰 Your balance: ${user.coins} coins\n` +
            `🎮 Games played: ${user.totalGames}\n` +
            `🏆 Games won: ${user.gamesWon}\n` +
            `💎 Total won: ${user.totalWon} coins`;
        } else {
          response = `Please start the game first! Click "Play BINGO" below.`;
        }
        
      } else if (text === '/help') {
        response = `📖 Habesha BINGO Help:\n\n` +
          `Commands:\n` +
          `/start - Welcome message\n` +
          `/play - How to play\n` +
          `/balance - Check your coins\n` +
          `/help - This message\n\n` +
          `Game Rules:\n` +
          `• Each game has 75 numbers (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)\n` +
          `• Center square is FREE\n` +
          `• Match rows, columns, diagonals, or full house\n\n` +
          `Need more help? Contact @admin`;
          
      } else {
        response = `I don't understand that command. Try /help`;
      }

      // Send response back to user
      await this.sendMessage(chatId, response);
      
      res.sendStatus(200);
      
    } catch (error) {
      console.error('Bot command error:', error);
      res.sendStatus(200); // Always return 200 to Telegram
    }
  }

  // Send message via Telegram API
  async sendMessage(chatId, text) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: '🎮 Play BINGO',
                  web_app: { url: process.env.FRONTEND_URL }
                }
              ]]
            }
          })
        }
      );
      
      return await response.json();
    } catch (error) {
      console.error('Send message error:', error);
    }
  }

  // Send game invitation
  async sendInvitation(userId, gameId, inviterName) {
    try {
      const message = `🎮 ${inviterName} invited you to play BINGO!\n\n` +
        `Game ID: ${gameId}\n` +
        `Click below to join the game!`;
      
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            text: message,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                {
                  text: 'Join Game',
                  web_app: { url: `${process.env.FRONTEND_URL}/game/${gameId}` }
                }
              ]]
            }
          })
        }
      );
      
      return await response.json();
    } catch (error) {
      console.error('Send invitation error:', error);
    }
  }
}

module.exports = new BotController();
