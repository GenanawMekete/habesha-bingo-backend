const { User, Transaction } = require('../config/database');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentController {
  // Get payment options
  async getPaymentOptions(req, res) {
    const options = [
      {
        id: 'coins_100',
        name: '100 Coins Pack',
        coins: 100,
        price: 4.99,
        currency: 'USD',
        bonus: 0,
        bestValue: false
      },
      {
        id: 'coins_250',
        name: '250 Coins Pack',
        coins: 250,
        price: 9.99,
        currency: 'USD',
        bonus: 25,
        bestValue: false
      },
      {
        id: 'coins_500',
        name: '500 Coins Pack',
        coins: 500,
        price: 17.99,
        currency: 'USD',
        bonus: 75,
        bestValue: true
      },
      {
        id: 'coins_1000',
        name: '1000 Coins Pack',
        coins: 1000,
        price: 29.99,
        currency: 'USD',
        bonus: 200,
        bestValue: false
      }
    ];

    res.json({ success: true, data: options });
  }

  // Create Stripe checkout session
  async createStripeCheckout(req, res) {
    try {
      const { packageId, successUrl, cancelUrl } = req.body;
      const user = req.user;

      // Get package details (in production, fetch from database)
      const packages = {
        'coins_100': { coins: 100, price: 499, name: '100 Coins' },
        'coins_250': { coins: 250, price: 999, name: '250 Coins (+25 Bonus)' },
        'coins_500': { coins: 500, price: 1799, name: '500 Coins (+75 Bonus)' },
        'coins_1000': { coins: 1000, price: 2999, name: '1000 Coins (+200 Bonus)' }
      };

      const package = packages[packageId];
      if (!package) {
        return res.status(400).json({
          success: false,
          message: 'Invalid package'
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `BINGO Coins - ${package.name}`,
              description: `Get ${package.coins} coins for playing BINGO`
            },
            unit_amount: package.price
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        client_reference_id: user.telegramId,
        metadata: {
          telegramId: user.telegramId,
          packageId,
          coins: package.coins
        }
      });

      // Create pending transaction
      const transaction = new Transaction({
        transactionId: `stripe_${session.id}`,
        userId: user.telegramId,
        type: 'purchase',
        amount: package.coins,
        description: `Purchase ${package.name} via Stripe`,
        status: 'pending',
        metadata: {
          sessionId: session.id,
          packageId,
          stripe: true
        }
      });

      await transaction.save();

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url
        }
      });
    } catch (error) {
      console.error('Stripe error:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating payment session'
      });
    }
  }

  // Handle Stripe webhook
  async handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Update transaction and user coins
        await this.processSuccessfulPayment(
          session.id,
          session.metadata.telegramId,
          parseInt(session.metadata.coins)
        );
        break;
      
      case 'checkout.session.expired':
        const expiredSession = event.data.object;
        
        // Mark transaction as failed
        await Transaction.findOneAndUpdate(
          { transactionId: `stripe_${expiredSession.id}` },
          { status: 'failed' }
        );
        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  }

  async processSuccessfulPayment(sessionId, telegramId, coins) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Update transaction
      await Transaction.findOneAndUpdate(
        { transactionId: `stripe_${sessionId}` },
        {
          status: 'completed',
          metadata: { ...session, processedAt: new Date() }
        }
      );

      // Update user coins
      await User.findOneAndUpdate(
        { telegramId },
        {
          $inc: { coins: coins },
          $set: { lastActive: new Date() }
        }
      );

      console.log(`Payment processed for ${telegramId}: ${coins} coins`);
    }
  }

  // Telegram Stars payment (if using Telegram's payment system)
  async processTelegramStars(req, res) {
    try {
      const { initData, amount, currency } = req.body;
      
      // Verify Telegram payment (simplified - actual implementation depends on Telegram's API)
      // This would involve verifying with Telegram's payment API
      
      const user = req.user;
      const coins = amount * 20; // Example conversion: 1 star = 20 coins
      
      // Update user balance
      user.coins += coins;
      await user.save();

      // Record transaction
      const transaction = new Transaction({
        transactionId: `tg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        userId: user.telegramId,
        type: 'purchase',
        amount: coins,
        description: `Purchased ${coins} coins via Telegram Stars`,
        status: 'completed',
        metadata: {
          provider: 'telegram',
          stars: amount,
          currency
        }
      });

      await transaction.save();

      res.json({
        success: true,
        data: {
          coinsAdded: coins,
          newBalance: user.coins,
          transactionId: transaction.transactionId
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error processing payment'
      });
    }
  }
}

module.exports = new PaymentController();
