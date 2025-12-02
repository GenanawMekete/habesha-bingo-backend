const User = require('../models/User');
const Game = require('../models/Game');
const Transaction = require('../models/Transaction');

class BotController {
  // Main command handler
  async handleCommand(req, res) {
    try {
      const { message } = req.body;
      
      if (!message || !message.text) {
        return res.sendStatus(200);
      }

      const chatId = message.chat.id;
      const text = message.text;
      const args = text.split(' ');
      const command = args[0].toLowerCase();
      
      let response = '';
      
      // Route commands
      switch(command) {
        case '/start':
          response = await this.handleStart(chatId, message, args);
          break;
        case '/register':
          response = await this.handleRegister(chatId);
          break;
        case '/play':
          response = await this.handlePlay(chatId);
          break;
        case '/deposit':
          response = await this.handleDeposit(chatId, args);
          break;
        case '/balance':
          response = await this.handleBalance(chatId);
          break;
        case '/withdraw':
          response = await this.handleWithdraw(chatId, args);
          break;
        case '/transfer':
          response = await this.handleTransfer(chatId, args);
          break;
        case '/instruction':
          response = await this.handleInstruction(chatId);
          break;
        case '/support':
          response = await this.handleSupport(chatId);
          break;
        case '/invite':
          response = await this.handleInvite(chatId);
          break;
        case '/help':
          response = await this.handleHelp(chatId);
          break;
        default:
          response = `🤖 Unknown command. Use /help to see available commands.`;
      }

      // Send response to user
      await this.sendTelegramMessage(chatId, response);
      
      res.sendStatus(200);
      
    } catch (error) {
      console.error('Bot command error:', error);
      res.sendStatus(200); // Always return 200 to Telegram
    }
  }

  // ==================== COMMAND IMPLEMENTATIONS ====================

  // 1. /start command
  async handleStart(chatId, message, args) {
    // Check if user exists
    let user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      // Auto-register on first /start
      user = new User({
        telegramId: chatId.toString(),
        username: message.from.username,
        firstName: message.from.first_name,
        lastName: message.from.last_name,
        languageCode: message.from.language_code || 'en',
        coins: 100 // Starting bonus
      });
      
      // Check if referred
      if (args[1] && args[1].startsWith('ref_')) {
        const referrerId = args[1].replace('ref_', '');
        user.referredBy = referrerId;
        
        // Give referrer bonus
        const referrer = await User.findOne({ telegramId: referrerId });
        if (referrer) {
          referrer.coins += 50;
          referrer.referrals.push({
            telegramId: chatId.toString(),
            username: message.from.username,
            date: new Date(),
            rewardClaimed: true
          });
          await referrer.save();
        }
      }
      
      await user.save();
      
      return `🎉 Welcome to Habesha BINGO!\n\n` +
             `✅ Account created successfully!\n` +
             `🎁 Bonus: 100 free coins added\n\n` +
             `👤 Name: ${user.firstName} ${user.lastName || ''}\n` +
             `💰 Balance: ${user.coins} coins\n\n` +
             `Use /help to see all commands`;
    }
    
    return `👋 Welcome back, ${user.firstName}!\n\n` +
           `💰 Balance: ${user.coins} coins\n` +
           `🎮 Games: ${user.totalGames} played\n` +
           `🏆 Wins: ${user.gamesWon}\n\n` +
           `Use /play to start a game or /help for more commands`;
  }

  // 2. /register command
  async handleRegister(chatId) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (user) {
      return `✅ Account Details:\n\n` +
             `👤 Name: ${user.firstName} ${user.lastName || ''}\n` +
             `📧 Username: @${user.username || 'N/A'}\n` +
             `💰 Balance: ${user.coins} coins\n` +
             `🎮 Games Played: ${user.totalGames}\n` +
             `🏆 Games Won: ${user.gamesWon}\n` +
             `💎 VIP Level: ${user.vipLevel}\n\n` +
             `🆔 Your ID: ${user.telegramId}`;
    } else {
      // Auto-register if not exists
      return `Please use /start first to register your account!`;
    }
  }

  // 3. /play command
  async handlePlay(chatId) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      return `⚠️ Please use /start first to register!`;
    }
    
    if (user.coins < 10) {
      return `❌ Insufficient coins!\n\n` +
             `You need at least 10 coins to play.\n` +
             `Current balance: ${user.coins} coins\n\n` +
             `Use /deposit to add more coins or /invite to earn free coins.`;
    }
    
    const games = await Game.find({ status: 'active' }).limit(5);
    
    let gamesList = '';
    if (games.length > 0) {
      games.forEach((game, index) => {
        gamesList += `${index + 1}. ${game.name} - ${game.prizePool} coins prize\n`;
      });
    } else {
      gamesList = 'No active games. Check back soon!';
    }
    
    return `🎮 Play BINGO\n\n` +
           `💰 Your balance: ${user.coins} coins\n` +
           `🎯 Entry fee: 10-200 coins per game\n\n` +
           `🏆 Active Games:\n${gamesList}\n\n` +
           `🌐 Visit: ${process.env.FRONTEND_URL}\n` +
           `To select cards and join a game!\n\n` +
           `💡 Pro Tip: More cards = better chances!`;
  }

  // 4. /deposit command
  async handleDeposit(chatId, args) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      return `⚠️ Please use /start first to register!`;
    }
    
    // If amount specified
    if (args[1]) {
      const amount = parseInt(args[1]);
      if (isNaN(amount) || amount < 100) {
        return `❌ Minimum deposit is 100 coins!\n` +
               `Example: /deposit 500`;
      }
      
      // In real app, you'd generate payment link
      const paymentId = 'DEP' + Date.now() + Math.random().toString(36).substr(2, 6);
      
      return `💳 Deposit Request\n\n` +
             `Amount: ${amount} coins\n` +
             `Payment ID: ${paymentId}\n\n` +
             `📋 Payment Methods:\n` +
             `1. Telebirr - 0912345678\n` +
             `2. CBE Birr - 0912345678\n` +
             `3. Bank Transfer:\n` +
             `   Bank: Commercial Bank of Ethiopia\n` +
             `   Account: 100034567890\n` +
             `   Name: Habesha BINGO\n\n` +
             `📸 After payment, send screenshot to @admin\n` +
             `with your Payment ID: ${paymentId}`;
    }
    
    return `💰 Deposit Options\n\n` +
           `Minimum: 100 coins\n` +
           `Exchange: 1 ETB = 10 coins\n\n` +
           `📋 Payment Methods:\n` +
           `1. Telebirr - 0912345678\n` +
           `2. CBE Birr - 0912345678\n` +
           `3. Bank Transfer\n\n` +
           `📱 To deposit, use:\n` +
           `/deposit AMOUNT\n` +
           `Example: /deposit 500\n\n` +
           `📞 Support: @habesha_bingo_admin`;
  }

  // 5. /balance command
  async handleBalance(chatId) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      return `⚠️ Please use /start first to register!`;
    }
    
    // Calculate rank
    const totalUsers = await User.countDocuments();
    const rank = await User.countDocuments({ coins: { $gt: user.coins } }) + 1;
    
    // Recent transactions
    const recentTx = user.transactions.slice(-3).reverse();
    let txList = '';
    recentTx.forEach(tx => {
      const sign = tx.type.includes('win') || tx.type === 'deposit' || tx.type === 'bonus' ? '+' : '-';
      txList += `• ${sign}${tx.amount} - ${tx.description}\n`;
    });
    
    return `💰 Account Balance\n\n` +
           `🆔 ID: ${user.telegramId}\n` +
           `👤 Name: ${user.firstName}\n` +
           `🏆 VIP: ${user.vipLevel}\n\n` +
           `📊 Balance: ${user.coins} coins\n` +
           `📈 Total Deposited: ${user.totalDeposited} coins\n` +
           `📉 Total Withdrawn: ${user.totalWithdrawn} coins\n\n` +
           `🎮 Game Stats:\n` +
           `   Games: ${user.totalGames} played\n` +
           `   Wins: ${user.gamesWon} games\n` +
           `   Win Rate: ${user.totalGames > 0 ? Math.round((user.gamesWon / user.totalGames) * 100) : 0}%\n` +
           `   Total Won: ${user.totalWon} coins\n\n` +
           `🏅 Rank: #${rank} out of ${totalUsers} players\n\n` +
           `📜 Recent Activity:\n${txList || 'No recent activity'}`;
  }

  // 6. /withdraw command
  async handleWithdraw(chatId, args) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      return `⚠️ Please use /start first to register!`;
    }
    
    const minWithdraw = 1000;
    
    if (args[1]) {
      const amount = parseInt(args[1]);
      
      if (isNaN(amount)) {
        return `❌ Invalid amount! Use: /withdraw AMOUNT`;
      }
      
      if (amount < minWithdraw) {
        return `❌ Minimum withdrawal is ${minWithdraw} coins!`;
      }
      
      if (amount > user.coins) {
        return `❌ Insufficient balance!\n` +
               `Available: ${user.coins} coins\n` +
               `Requested: ${amount} coins`;
      }
      
      // Calculate fee (5%)
      const fee = Math.round(amount * 0.05);
      const netAmount = amount - fee;
      
      const withdrawId = 'WDL' + Date.now() + Math.random().toString(36).substr(2, 6);
      
      // Add to transactions (but don't deduct yet - wait for admin approval)
      user.transactions.push({
        type: 'withdraw',
        amount: amount,
        description: `Withdrawal request #${withdrawId}`
      });
      await user.save();
      
      return `💸 Withdrawal Request\n\n` +
             `Request ID: ${withdrawId}\n` +
             `Amount: ${amount} coins\n` +
             `Fee (5%): ${fee} coins\n` +
             `Net Amount: ${netAmount} coins (≈${Math.round(netAmount/10)} ETB)\n\n` +
             `📋 Send this info to @habesha_bingo_admin:\n` +
             `1. Withdrawal ID: ${withdrawId}\n` +
             `2. Amount: ${amount} coins\n` +
             `3. Your preferred payment method\n` +
             `4. Account details\n\n` +
             `⏰ Processing time: 24-48 hours`;
    }
    
    return `💸 Withdrawal Information\n\n` +
           `Minimum: ${minWithdraw} coins (100 ETB)\n` +
           `Fee: 5% of withdrawal amount\n` +
           `Processing: 24-48 hours\n\n` +
           `📋 Payment Methods:\n` +
           `• Telebirr\n` +
           `• CBE Birr\n` +
           `• Bank Transfer\n\n` +
           `💰 Your balance: ${user.coins} coins\n\n` +
           `📝 To withdraw, use:\n` +
           `/withdraw AMOUNT\n` +
           `Example: /withdraw 1000\n\n` +
           `📞 Contact: @habesha_bingo_admin`;
  }

  // 7. /transfer command
  async handleTransfer(chatId, args) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      return `⚠️ Please use /start first to register!`;
    }
    
    // Format: /transfer @username amount
    if (args.length < 3) {
      return `🔄 Transfer Coins\n\n` +
             `Format: /transfer @username AMOUNT\n` +
             `Example: /transfer @john_doe 500\n\n` +
             `💰 Your balance: ${user.coins} coins\n` +
             `💡 Minimum transfer: 10 coins\n` +
             `✅ No transfer fees\n\n` +
             `📋 Recent transfers:\n` +
             `• To @friend1 - 200 coins\n` +
             `• To @friend2 - 100 coins`;
    }
    
    const recipientUsername = args[1].replace('@', '');
    const amount = parseInt(args[2]);
    
    if (isNaN(amount) || amount < 10) {
      return `❌ Minimum transfer is 10 coins!`;
    }
    
    if (amount > user.coins) {
      return `❌ Insufficient balance!\n` +
             `Available: ${user.coins} coins\n` +
             `Requested: ${amount} coins`;
    }
    
    // Find recipient
    const recipient = await User.findOne({ username: recipientUsername });
    
    if (!recipient) {
      return `❌ User @${recipientUsername} not found!\n` +
             `Make sure they have used /start with the bot.`;
    }
    
    if (recipient.telegramId === chatId.toString()) {
      return `❌ You cannot transfer to yourself!`;
    }
    
    // Perform transfer
    user.coins -= amount;
    recipient.coins += amount;
    
    // Record transactions
    user.transactions.push({
      type: 'transfer',
      amount: -amount,
      description: `Transfer to @${recipientUsername}`
    });
    
    recipient.transactions.push({
      type: 'transfer',
      amount: amount,
      description: `Transfer from @${user.username || user.firstName}`
    });
    
    await user.save();
    await recipient.save();
    
    // Notify recipient
    await this.sendTelegramMessage(
      recipient.telegramId,
      `💰 You received ${amount} coins from @${user.username || user.firstName}!`
    );
    
    return `✅ Transfer successful!\n\n` +
           `To: @${recipientUsername}\n` +
           `Amount: ${amount} coins\n` +
           `New balance: ${user.coins} coins\n\n` +
           `📫 Recipient has been notified.`;
  }

  // 8. /instruction command
  async handleInstruction(chatId) {
    return `📖 How to Play Habesha BINGO\n\n` +
           `🎯 Objective:\n` +
           `Complete patterns (lines, full house) before others.\n\n` +
           `🎰 Game Setup:\n` +
           `1. Use /play or visit ${process.env.FRONTEND_URL}\n` +
           `2. Select 1-20 cards (more cards = better chances)\n` +
           `3. Each card costs 10 coins (discounts for bulk)\n` +
           `4. Join a game room or create your own\n\n` +
           `🔢 Number Ranges:\n` +
           `B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75\n` +
           `Center square is FREE\n\n` +
           `🏆 Winning Patterns:\n` +
           `• Any horizontal line\n` +
           `• Any vertical line\n` +
           `• Any diagonal line\n` +
           `• Four corners\n` +
           `• Full house (all numbers)\n\n` +
           `💰 Pricing & Discounts:\n` +
           `1 card = 10 coins\n` +
           `3 cards = 27 coins (10% off)\n` +
           `5 cards = 40 coins (20% off)\n` +
           `10+ cards = 25-30% off\n\n` +
           `🎁 Daily Bonuses:\n` +
           `• Daily login bonus\n` +
           `• Win streak bonus\n` +
           `• Referral bonus\n\n` +
           `📱 Need help? Use /support`;
  }

  // 9. /support command
  async handleSupport(chatId) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    const userId = user ? user.telegramId : chatId;
    
    return `🆘 Customer Support\n\n` +
           `📞 Contact Methods:\n` +
           `• Admin: @habesha_bingo_admin\n` +
           `• Email: support@habeshabingo.com\n` +
           `• Channel: @habesha_bingo_updates\n\n` +
           `🕒 Support Hours:\n` +
           `24/7 (Response within 6 hours)\n\n` +
           `🌍 Languages:\n` +
           `English, Amharic, Oromiffa\n\n` +
           `📋 Please provide:\n` +
           `1. Your User ID: ${userId}\n` +
           `2. Detailed description\n` +
           `3. Screenshots if needed\n\n` +
           `⚠️ Common Issues:\n` +
           `• Deposit not showing? Send payment proof\n` +
           `• Game error? Restart and try again\n` +
           `• Account issues? Contact admin directly\n\n` +
           `🙏 Thank you for playing Habesha BINGO!`;
  }

  // 10. /invite command
  async handleInvite(chatId) {
    const user = await User.findOne({ telegramId: chatId.toString() });
    
    if (!user) {
      return `⚠️ Please use /start first to register!`;
    }
    
    const referralLink = `https://t.me/${process.env.BOT_USERNAME}?start=ref_${chatId}`;
    const totalReferrals = user.referrals.length;
    const referralEarnings = totalReferrals * 50;
    
    return `📢 Invite & Earn Program\n\n` +
           `Your personal referral link:\n` +
           `${referralLink}\n\n` +
           `🎁 Rewards:\n` +
           `• You get 50 coins per referral\n` +
           `• Friend gets 100 bonus coins\n` +
           `• 10% of their first deposit\n` +
           `• Bonus when they win big!\n\n` +
           `📊 Your Referral Stats:\n` +
           `Total referrals: ${totalReferrals}\n` +
           `Earned from referrals: ${referralEarnings} coins\n\n` +
           `📝 How it works:\n` +
           `1. Share your link above\n` +
           `2. Friend clicks and uses /start\n` +
           `3. Both get bonuses automatically\n` +
           `4. Track earnings in /balance\n\n` +
           `💡 Share on:\n` +
           `• WhatsApp groups\n` +
           `• Telegram channels\n` +
           `• Facebook\n` +
           `• With friends and family`;
  }

  // 11. /help command (additional)
  async handleHelp(chatId) {
    return `🤖 Habesha BINGO - Help Menu\n\n` +
           `📋 Account Commands:\n` +
           `/start - Register/Login\n` +
           `/register - Account details\n` +
           `/balance - Check balance\n` +
           `/invite - Invite friends\n\n` +
           `🎮 Game Commands:\n` +
           `/play - Start playing\n` +
           `/instruction - How to play\n\n` +
           `💰 Money Commands:\n` +
           `/deposit - Add coins\n` +
           `/withdraw - Cash out\n` +
           `/transfer - Send to friends\n\n` +
           `🆘 Support:\n` +
           `/support - Get help\n\n` +
           `🌐 Website:\n` +
           `${process.env.FRONTEND_URL}\n\n` +
           `📱 Quick Tips:\n` +
           `• Type / then select any command\n` +
           `• More cards = better chances\n` +
           `• Check /instruction for game rules\n` +
           `• Contact /support for issues`;
  }

  // ==================== HELPER FUNCTIONS ====================

  // Send message to Telegram
  async sendTelegramMessage(chatId, text) {
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
            disable_web_page_preview: true
          })
        }
      );
      
      return await response.json();
    } catch (error) {
      console.error('Error sending Telegram message:', error);
    }
  }

  // Update user VIP level
  async updateVIPLevel(user) {
    const experience = user.experience;
    
    if (experience >= 10000) user.vipLevel = 'Diamond';
    else if (experience >= 5000) user.vipLevel = 'Platinum';
    else if (experience >= 1000) user.vipLevel = 'Gold';
    else if (experience >= 500) user.vipLevel = 'Silver';
    else user.vipLevel = 'Bronze';
    
    await user.save();
  }
}

module.exports = new BotController();
