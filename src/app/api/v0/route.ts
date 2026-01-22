import { NextRequest, NextResponse } from 'next/server';

// v0 SDK integration for generating React components
// Requires V0_API_KEY environment variable

interface V0ChatResponse {
  id: string;
  demo?: string;
  code?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { message, chatId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if v0 API key is configured
    const apiKey = process.env.V0_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'V0_API_KEY not configured. Add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // Dynamic import to avoid build issues if v0-sdk isn't installed
    let chat: V0ChatResponse;

    try {
      const { v0 } = await import('v0-sdk');

      if (chatId) {
        // Continue existing chat
        chat = await v0.chats.sendMessage({
          chatId,
          message,
        });
      } else {
        // Create new chat
        chat = await v0.chats.create({
          message,
        });
      }

      return NextResponse.json({
        id: chat.id,
        demo: chat.demo,
        code: chat.code,
      });
    } catch (sdkError) {
      // If v0-sdk fails (e.g., not configured), return a helpful error
      console.error('v0 SDK error:', sdkError);
      return NextResponse.json(
        {
          error: 'Failed to communicate with v0 API. Make sure V0_API_KEY is valid.',
          details: sdkError instanceof Error ? sdkError.message : String(sdkError),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('V0 API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// GET endpoint to check v0 configuration status
export async function GET() {
  const isConfigured = !!process.env.V0_API_KEY;

  return NextResponse.json({
    configured: isConfigured,
    message: isConfigured
      ? 'v0 API is configured and ready'
      : 'v0 API is not configured. Set V0_API_KEY in .env.local',
  });
}
