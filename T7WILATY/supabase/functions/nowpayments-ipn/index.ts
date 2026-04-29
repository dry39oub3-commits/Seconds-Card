import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.text()
    const payment = JSON.parse(body)

    const signature = req.headers.get('x-nowpayments-sig') || ''
    const secret = Deno.env.get('NOWPAYMENTS_IPN_SECRET') || ''

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )

    const sortedBody = JSON.stringify(
      Object.keys(payment).sort().reduce((acc: Record<string, unknown>, k) => {
        acc[k] = payment[k]
        return acc
      }, {})
    )

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(sortedBody)
    )

    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    if (signature !== expectedSignature) {
      return new Response('Invalid signature', { status: 401 })
    }

    if (
      payment.payment_status === 'finished' ||
      payment.payment_status === 'confirmed'
    ) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )

      await supabase
        .from('orders')
        .update({
          status: 'مكتمل',
          nowpayments_id: String(payment.payment_id)
        })
        .eq('id', payment.order_id)
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('Error:', err)
    return new Response('Server Error', { status: 500 })
  }
})