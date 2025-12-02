const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

class TelegramController {
  // Verify Telegram WebApp data
  verifyTelegramData(initData) {
    try {
      const encoded = decodeURIComponent(initData);
      const secret = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.TELEGRAM_BOT_TOKEN)
        .digest();
      
      const arr = encoded.split('&');
      const hashIndex = arr.findIndex(str => str.startsWith('hash='));
      const hash = arr[hashIndex].split('=')[1];
      
      const checkString = arr
        .filter((_, index) => index !== hashIndex)
        .sort((a, b) => a.localeCompare(b))
        .join('\n');
      
      const _hash = crypto
        .createHmac('sha256', secret)
        .update(checkString)
        .digest('hex');
      
      return _hash === hash;
    } catch (error) {
      console.error('Telegram verification error:', error);
      return false;
    }
  }

  // Parse user data from initData
  parseInitData(initData) {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    const authDate = params.get('auth_date');
    const queryId = params.get('query_id');
    
    if (!userStr) return null;
    
    try {
      const user = JSON.parse(userStr);
      return {
        ...user,
        auth_date: authDate,
        query_id: queryId
      };
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }

  // Authenticate Telegram user
  async authenticate(req, res) {
    try {
      const { initData } = req.body;
      
      if (!initData) {
        return res.status(400).json({
          success: false,
          message: 'Telegram initData is required'
        });
      }

      // Verify Telegram data
      const isValid = this.verifyTelegramData(initData);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Telegram data'
        });
      }

      // Parse user data
      const telegramUser = this.parseInitData(initData);
      
      if (!telegramUser) {
        return res.status(400).json({
          success: false,
          message: 'Could not parse user data'
        });
      }

      // Find or create user
      let user = await User.findOne({ telegramId: telegramUser.id.toString() });

      if (!user) {
        // New user - give bonus coins
        user = new User({
          telegramId: telegramUser.id.toString(),
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
          photoUrl: telegramUser.photo_url,
          coins: 100, // Starting bonus
          isPremium: telegramUser.is_premium || false,
          languageCode: telegramUser.language_code,
          lastActive: new Date()
        });
      } else {
        // Update existing user
        user.username = telegramUser.username;
        user.firstName = telegramUser.first_name;
        user.lastName = telegramUser.last_name;
        user.photoUrl = telegramUser.photo_url;
        user.isPremium = telegramUser.is_premium || false;
        user.languageCode = telegramUser.language_code;
        user.lastActive = new Date();
      }

      await user.save();

      // Generate JWT token
      const token = generateToken(user);

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          photoUrl: user.photoUrl,
          coins: user.coins,
          isPremium: user.isPremium,
          totalGames: user.totalGames,
          gamesWon: user.gamesWon
        }
      });

    } catch (error) {
      console.error('Telegram auth error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }

  // Get bot info
  async getBotInfo(req, res) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`
      );
      const data = await response.json();
      
      res.json({
        success: data.ok,
        bot: data.result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch bot info'
      });
    }
  }

  // Send notification to user
  async sendNotification(req, res) {
    try {
      const { userId, message } = req.body;
      
      const user = await User.findOne({ telegramId: userId });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: userId,
            text: message,
            parse_mode: 'HTML'
          })
        }
      );

      const data = await response.json();

      res.json({
        success: data.ok,
        message: data.ok ? 'Notification sent' : 'Failed to send notification'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to send notification'
      });
    }
  }
}

module.exports = new TelegramController();
