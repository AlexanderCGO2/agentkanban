import { NextRequest, NextResponse } from 'next/server';
import { agentStore } from '@/lib/agent-store';
import { CreateAgentRequest, ToolName, PermissionMode, AgentRole } from '@/types/agent';

export async function GET() {
  try {
    const agents = await agentStore.getAllAgents();
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateAgentRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.prompt || !body.allowedTools || !body.permissionMode) {
      return NextResponse.json(
        { error: 'Missing required fields: name, prompt, allowedTools, permissionMode' },
        { status: 400 }
      );
    }

    // Validate tool names
    const validTools: ToolName[] = [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Task', 'NotebookEdit'
    ];
    const invalidTools = body.allowedTools.filter(t => !validTools.includes(t));
    if (invalidTools.length > 0) {
      return NextResponse.json(
        { error: `Invalid tools: ${invalidTools.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate permission mode
    const validModes: PermissionMode[] = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    if (!validModes.includes(body.permissionMode)) {
      return NextResponse.json(
        { error: `Invalid permission mode: ${body.permissionMode}` },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: AgentRole[] = [
      'design', 'intern', 'project-manager', 'team-assist', 
      'data-analyst', 'copywriter', 'accountant', 'developer', 'custom'
    ];
    const role = body.role || 'custom';
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }

    const agent = await agentStore.createAgent({
      name: body.name,
      role: role,
      prompt: body.prompt,
      allowedTools: body.allowedTools,
      permissionMode: body.permissionMode,
      maxTurns: body.maxTurns,
      systemPrompt: body.systemPrompt,
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
