import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/db';

export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL environment variable is not set' },
        { status: 400 }
      );
    }

    await initializeDatabase();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema initialized successfully' 
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json(
      { error: 'Failed to initialize database', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const hasDatabase = !!process.env.DATABASE_URL;
  
  return NextResponse.json({
    databaseConfigured: hasDatabase,
    mode: hasDatabase ? 'database' : 'in-memory',
    message: hasDatabase 
      ? 'Database is configured. POST to this endpoint to initialize the schema.'
      : 'No DATABASE_URL configured. Using in-memory storage (data will not persist).'
  });
}
