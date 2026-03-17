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

    // Determine who to send the SMS to. Modify this to use your own phone number for testing,
    // or use `record.phone` if available.
    const TEST_PHONE_NUMBER = "+917387654912" // Replace with your actual number for Twilio trial

    if (payload.table === 'bookings') {
      const { type, record, old_record } = payload

      // Patient Books Bed (INSERT)
      if (type === 'INSERT') {
        const msg = `MedQueue: Your booking request is received. We are awaiting hospital confirmation.`
        await sendSms(TEST_PHONE_NUMBER, msg)
      }

      // Hospital Updates Booking (UPDATE)
      if (type === 'UPDATE' && old_record.status !== record.status) {
        if (record.status === 'confirmed') {
          const msg = `MedQueue: YAY! Your bed booking is CONFIRMED. Please head to the hospital.`
          await sendSms(TEST_PHONE_NUMBER, msg)
        }
        if (record.status === 'admitted') {
          const msg = `MedQueue: You have been successfully admitted to the hospital.`
          await sendSms(TEST_PHONE_NUMBER, msg)
        }
      }
    }

    if (payload.table === 'dispatches') {
      const { type, record, old_record } = payload

      // Patient requests SOS (INSERT, ambulance_id is null)
      if (type === 'INSERT' && !record.ambulance_id) {
        const msg = `🚨 EMERGENCY (MedQueue): A patient requested an SOS near your area.`
        // Broadcast SMS to nearest driver (simplified for example)
        await sendSms(TEST_PHONE_NUMBER, msg)
      }

      // Ambulance accepts dispatch (UPDATE)
      if (type === 'UPDATE' && old_record.status !== record.status) {
        if (record.status === 'accepted') {
          const msg = `🚑 MedQueue: An ambulance is on the way to your location!`
          await sendSms(TEST_PHONE_NUMBER, msg)
        }
        if (record.status === 'arrived') {
          const msg = `🚑 MedQueue: Your ambulance has arrived!`
          await sendSms(TEST_PHONE_NUMBER, msg)
        }
      }
    }

    // Landing Page SOS (Emergency Requests)
    if (payload.table === 'emergency_requests') {
      const { type, record } = payload
      if (type === 'INSERT') {
        const msg = `🚨 URGENT MedQueue SOS from Landing Page! Contact: ${record.phone}, Type: ${record.type}. Location: ${record.lat}, ${record.lng}.`
        // We can send to the test number, or directly to the patient's phone if they used a Twilio verified number
        await sendSms(TEST_PHONE_NUMBER, msg)

        // If you want to reply to the user who requested help directly:
        // await sendSms(record.phone, `MedQueue: Your SOS request has been received. Help is on the way.`)
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
