// supabase/functions/send-notification/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Twilio credentials defined safely in Supabase Secrets
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM_PHONE = Deno.env.get('TWILIO_FROM_PHONE')

// Helper function to send an SMS via Twilio API
async function sendSms(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM_PHONE) return

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const data = new URLSearchParams()
  data.append('To', to)
  data.append('From', TWILIO_FROM_PHONE)
  data.append('Body', body)

  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: data.toString()
  })
  return res.json()
}

// Main Edge Function Handler
serve(async (req) => {
  try {
    const payload = await req.json()

    console.log("Webhook Triggered:", payload.table, payload.type)

    if (payload.table === 'bookings') {
      const { type, record, old_record } = payload

      // Patient Books Bed (INSERT)
      if (type === 'INSERT') {
        const msg = `MedQueue: Your booking request is received. We are awaiting hospital confirmation.`
        // Assume you fetch user's phone in a real scenario by querying the DB
        await sendSms("+917387654912", msg) // Replace with DB lookup
      }

      // Hospital Updates Booking (UPDATE)
      if (type === 'UPDATE' && old_record.status !== record.status) {
        if (record.status === 'confirmed') {
          const msg = `MedQueue: YAY! Your bed booking is CONFIRMED. Please head to the hospital.`
          await sendSms("+917387654912", msg)
        }
        if (record.status === 'admitted') {
          const msg = `MedQueue: You have been successfully admitted to the hospital.`
          await sendSms("+917387654912", msg)
        }
      }
    }

    if (payload.table === 'dispatches') {
      const { type, record, old_record } = payload

      // Patient requests SOS (INSERT, ambulance_id is null)
      if (type === 'INSERT' && !record.ambulance_id) {
        const msg = `🚨 EMERGENCY (MedQueue): A patient requested an SOS near your area.`
        // Broadcast SMS to nearest driver (simplified for example)
        await sendSms("+917387654912", msg)
      }

      // Ambulance accepts dispatch (UPDATE)
      if (type === 'UPDATE' && old_record.status !== record.status) {
        if (record.status === 'accepted') {
          const msg = `🚑 MedQueue: An ambulance is on the way to your location!`
          await sendSms("+917387654912", msg)
        }
        if (record.status === 'arrived') {
          const msg = `🚑 MedQueue: Your ambulance has arrived!`
          await sendSms("+917387654912", msg)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("Function Error:", error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
