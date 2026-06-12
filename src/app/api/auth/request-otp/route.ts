import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import Twilio from 'twilio';
import { signOtpToken } from '@/lib/auth';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const OTP_PROVIDER = process.env.OTP_PROVIDER?.toLowerCase();

export async function POST(request: Request) {
  try {
    if (OTP_PROVIDER !== 'twilio') {
      return NextResponse.json({ error: 'OTP provider is not configured.' }, { status: 500 });
    }

    if (!ACCOUNT_SID || !AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return NextResponse.json({ error: 'Twilio configuration is incomplete.' }, { status: 500 });
    }

    const { mobile } = (await request.json()) as { mobile?: string };
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return NextResponse.json({ error: 'Valid 10-digit mobile number is required.' }, { status: 400 });
    }

    const formattedMobile = `+91${mobile}`;
    if (formattedMobile === TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        { error: 'Unable to send OTP to the same number as the Twilio sender. Please use a different mobile number or configure a different Twilio phone number.' },
        { status: 400 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpToken = signOtpToken(mobile, otp);

    const client = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
    await client.messages.create({
      body: `Your OTP for Farmer Welfare registration is ${otp}. This code is valid for 5 minutes.`,
      from: TWILIO_PHONE_NUMBER,
      to: formattedMobile,
    });

    const response = NextResponse.json({ success: true, message: 'OTP sent successfully.' });
    response.cookies.set('otp_verification', otpToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 5,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('OTP request error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send OTP.' }, { status: 500 });
  }
}
