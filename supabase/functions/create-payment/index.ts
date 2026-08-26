import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:cors})
  try {
    const auth = req.headers.get('Authorization') || ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {global:{headers:{Authorization:auth}}})
    const {data:{user},error:userError} = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Authentication required')

    const {amount,currency='NGN',errandId,redirectUrl} = await req.json()
    if (!amount || Number(amount)<=0) throw new Error('Invalid amount')
    const secret = Deno.env.get('FLW_SECRET_KEY')
    if (!secret) throw new Error('Payment provider is not configured')

    const reference = `EG-${crypto.randomUUID()}`
    const payload = {tx_ref:reference,amount:Number(amount),currency,email:user.email,redirect_url:redirectUrl || Deno.env.get('APP_REDIRECT_URL'),meta:{errand_id:errandId || null,user_id:user.id}}
    const response = await fetch('https://api.flutterwave.com/v3/payments',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(payload)})
    const result = await response.json()
    if (!response.ok || result.status !== 'success') throw new Error(result.message || 'Unable to initialize payment')

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await admin.from('transactions').insert({user_id:user.id,errand_id:errandId || null,type:'deposit',amount:Number(amount),currency,reference,provider:'flutterwave',status:'pending',metadata:{tx_ref:reference}})
    return new Response(JSON.stringify({checkout_url:result.data.link,reference}),{headers:{...cors,'Content-Type':'application/json'}})
  } catch(e) { return new Response(JSON.stringify({error:e.message}),{status:400,headers:{...cors,'Content-Type':'application/json'}}) }
})
