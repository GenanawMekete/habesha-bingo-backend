module.exports = {
  // Pricing configuration
  PRICING: {
    SINGLE_CARD: 10,
    THREE_CARDS: 27,    // 10% discount
    FIVE_CARDS: 40,     // 20% discount
    TEN_CARDS: 75,      // 25% discount
    BUNDLES: {
      beginner: { count: 3, price: 27, discount: 10 },
      regular: { count: 5, price: 40, discount: 20 },
      pro: { count: 10, price: 75, discount: 25 },
      mega: { count: 20, price: 140, discount: 30 }
    }
  },

  // Game configuration
  GAME_CONFIG: {
    TOTAL_CARDS: 400,
    CARD_GRID_SIZE: 5,
    NUMBERS_PER_CARD: 25,
    NUMBER_RANGE: { min: 1, max: 75 },
    PATTERNS: ['standard', 'corners', 'cross', 'full-house']
  },

  // Telegram configuration
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_SECRET: process.env.TELEGRAM_SECRET,

  // Payment providers
  PAYMENT_PROVIDERS: {
    STRIPE: 'stripe',
    CRYPTO: 'crypto',
    TELEGRAM: 'telegram_stars'
  }
};
