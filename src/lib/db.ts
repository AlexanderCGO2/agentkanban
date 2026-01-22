import { neon } from '@neondatabase/serverless';

// Create a SQL query function using the database URL from environment
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set. Please add your Neon database connection string.');
  }
  return url;
};

// Lazy initialization of the SQL client
let sqlClient: ReturnType<typeof neon> | null = null;

export const sql = () => {
  if (!sqlClient) {
    sqlClient = neon(getDatabaseUrl());
  }
  return sqlClient;
};

// Schema initialization SQL
export const INIT_SCHEMA = `
-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'custom',
  prompt TEXT NOT NULL,
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  permission_mode VARCHAR(50) NOT NULL DEFAULT 'acceptEdits',
  max_turns INTEGER,
  system_prompt TEXT,
  cwd VARCHAR(500),
  output_dir VARCHAR(500),
  mcp_servers JSONB,
  enable_replicate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  sdk_session_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'idle',
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  tool_name VARCHAR(100),
  tool_input JSONB,
  tool_result JSONB,
  parent_tool_use_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create output_files table
CREATE TABLE IF NOT EXISTS output_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  path VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  content TEXT,
  url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_output_files_session_id ON output_files(session_id);
CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
`;

// Initialize the database schema
export async function initializeDatabase(): Promise<void> {
  try {
    const client = sql();
    console.log('Initializing database schema...');
    
    // Create agents table
    await client`
      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'custom',
        prompt TEXT NOT NULL,
        allowed_tools TEXT[] NOT NULL DEFAULT '{}',
        permission_mode VARCHAR(50) NOT NULL DEFAULT 'acceptEdits',
        max_turns INTEGER,
        system_prompt TEXT,
        cwd VARCHAR(500),
        output_dir VARCHAR(500),
        mcp_servers JSONB,
        enable_replicate BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Created agents table');

    // Create sessions table
    await client`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        sdk_session_id VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'idle',
        result JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Created sessions table');

    // Create messages table
    await client`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        tool_name VARCHAR(100),
        tool_input JSONB,
        tool_result JSONB,
        parent_tool_use_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Created messages table');

    // Create output_files table
    await client`
      CREATE TABLE IF NOT EXISTS output_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        path VARCHAR(500) NOT NULL,
        type VARCHAR(50) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL DEFAULT 0,
        content TEXT,
        url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    console.log('Created output_files table');

    // Create indexes
    await client`CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_output_files_session_id ON output_files(session_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role)`;
    await client`CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`;
    console.log('Created indexes');
    
    // Verify tables were created
    const tables = await client`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('agents', 'sessions', 'messages', 'output_files')` as { tablename: string }[];
    console.log('Agent tables created:', tables.map((t) => t.tablename));
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
}
