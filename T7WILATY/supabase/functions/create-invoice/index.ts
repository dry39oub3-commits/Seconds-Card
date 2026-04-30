import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, amount, description } = await req.json()

    const response = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('NOWPAYMENTS_API_KEY')!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
          price_amount:      amount,
          price_currency:    'usd',
          // احذف pay_currency ← العميل يختار
          order_id:          orderId,
          order_description: description,
          ipn_callback_url:  'https://btcmfdfepykwimukbiad.supabase.co/functions/v1/nowpayments-ipn',
          success_url:       'https://storecard.online/orders.html',
          cancel_url:        'https://storecard.online/checkout.html'
      })
    })

    const invoice = await response.json()

    return new Response(JSON.stringify(invoice), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})