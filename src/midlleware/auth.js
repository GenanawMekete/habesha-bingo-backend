const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

// Verify Telegram WebApp data
const verifyTelegramData = (initData) => {
  try {
    const encoded = decodeURIComponent(initData);
    const secret = crypto.createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN);
    
    const arr = encoded.split('&');
    const hashIndex = arr.findIndex(str => str.startsWith('hash='));
    const hash = arr[hashIndex].split('=')[1];
    
    const checkString = arr
      .filter((_, index) => index !== hashIndex)
      .sort((a, b) => a.localeCompare(b))
      .join('\n');
    
    const _hash = crypto
      .createHmac('sha256', secret.digest())
      .update(checkString)
      .digest('hex');
    
    return _hash === hash;
  } catch (error) {
    return false;
  }
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      telegramId: user.telegramId,
      username: user.username
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Authenticate middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ telegramId: decoded.telegramId });

    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Please authenticate'
    });
  }
};

module.exports = { verifyTelegramData, generateToken, authenticate };
