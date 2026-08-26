import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async req => {
  if (req.method !== 'POST') return new Response('Method Not Allowed',{status:405})
  const body = await req.text()
  const configuredHash = Deno.env.get('FLW_SECRET_HASH')
  const incomingHash = req.headers.get('verif-hash') || ''
  if (!configuredHash || incomingHash !== configuredHash) return new Response('Unauthorized',{status:401})
  try {
    const event = JSON.parse(body)
    const data = event.data || event
    const reference = data.tx_ref || data.reference
    const transactionId = data.id
    if (!reference) return new Response('Missing reference',{status:400})

    const admin = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const secret = Deno.env.get('FLW_SECRET_KEY')!
    const verify = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,{headers:{Authorization:`Bearer ${secret}`}})
    const verified = await verify.json()
    if (!verify.ok || verified.status !== 'success' || verified.data?.status !== 'successful' || verified.data?.tx_ref !== reference) return new Response('Payment not verified',{status:400})

    const {data:tx} = await admin.from('transactions').select('*').eq('reference',reference).single()
    if (!tx) return new Response('Transaction not found',{status:404})
    if (tx.status === 'successful') return new Response('Already processed',{status:200})
    const amount = Number(verified.data.amount)
    if (amount !== Number(tx.amount) || verified.data.currency !== tx.currency) return new Response('Amount mismatch',{status:400})

    await admin.from('transactions').update({status:'successful',metadata:{provider_event:event,verified_transaction_id:transactionId}}).eq('id',tx.id)
    await admin.rpc('credit_wallet_after_verified_payment',{p_user_id:tx.user_id,p_amount:amount,p_currency:tx.currency,p_transaction_id:tx.id})
    return new Response('OK',{status:200})
  } catch(e) { return new Response(e.message,{status:400}) }
})
