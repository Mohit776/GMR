interface RazorpayCheckoutOptions {
  keyId: string;
  amount: number;
  name: string;
  description: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillContact?: string;
  theme?: string;
}

export function generateRazorpayCheckoutHTML(options: RazorpayCheckoutOptions) {
  return `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
    <style>
      html, body { margin: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f0fdf4; }
      .wrap { height: 100%; display: grid; place-items: center; padding: 24px; text-align: center; color: #1f2937; }
      button { border: 0; border-radius: 14px; padding: 14px 22px; color: white; background: ${options.theme || '#16A34A'}; font-weight: 700; font-size: 16px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div>
        <h2>${options.name}</h2>
        <p>${options.description}</p>
        <button id="pay">Pay Securely</button>
      </div>
    </div>
    <script>
      function post(type, data) { window.ReactNativeWebView.postMessage(JSON.stringify({ type, data })); }
      var rzp = new Razorpay({
        key: ${JSON.stringify(options.keyId)},
        amount: ${Math.max(0, options.amount || 0)},
        currency: 'INR',
        name: ${JSON.stringify(options.name)},
        description: ${JSON.stringify(options.description)},
        prefill: {
          name: ${JSON.stringify(options.prefillName || '')},
          email: ${JSON.stringify(options.prefillEmail || '')},
          contact: ${JSON.stringify(options.prefillContact || '')}
        },
        theme: { color: ${JSON.stringify(options.theme || '#16A34A')} },
        handler: function(response) {
          post('PAYMENT_SUCCESS', {
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id || null,
            signature: response.razorpay_signature || null
          });
        },
        modal: { ondismiss: function() { post('PAYMENT_CANCELLED', { reason: 'dismissed' }); } }
      });
      rzp.on('payment.failed', function(response) { post('PAYMENT_FAILED', response.error || {}); });
      document.getElementById('pay').onclick = function() { rzp.open(); };
      setTimeout(function() { document.getElementById('pay').click(); }, 250);
    </script>
  </body>
</html>`;
}

