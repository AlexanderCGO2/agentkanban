/**
 * Research Agent - Multi-Agent Research System
 *
 * A sophisticated research agent that can delegate to specialized sub-agents:
 * - Researcher: Web search and data gathering
 * - Analyst: Data analysis and synthesis
 * - Writer: Content creation and formatting
 */

import type { Env, AgentConfig, SDKMessage, SubAgent } from '../types';
import { BaseAgent } from './base';

// ============================================================
// SUB-AGENT DEFINITIONS
// ============================================================

export const SUB_AGENTS: Record<string, SubAgent> = {
  researcher: {
    name: 'researcher',
    role: 'Research Specialist',
    systemPrompt: `You are a research specialist focused on gathering accurate, comprehensive information.

Your approach:
1. Identify key topics and questions to investigate
2. Search for relevant, credible sources
3. Gather data and evidence systematically
4. Document sources and findings clearly

Guidelines:
- Prioritize authoritative sources
- Note when information is uncertain or conflicting
- Provide citations when possible
- Flag gaps in available information`,
    tools: ['web_search', 'read_file', 'write_file'],
  },

  analyst: {
    name: 'analyst',
    role: 'Data Analyst',
    systemPrompt: `You are a data analyst focused on deriving insights from information.

Your approach:
1. Review and organize provided data
2. Identify patterns, trends, and anomalies
3. Draw logical conclusions from evidence
4. Formulate actionable recommendations

Guidelines:
- Support conclusions with data
- Acknowledge limitations and uncertainties
- Present findings clearly and objectively
- Distinguish between facts and interpretations`,
    tools: ['read_file', 'write_file', 'execute_python'],
  },

  writer: {
    name: 'writer',
    role: 'Content Writer',
    systemPrompt: `You are a content writer focused on creating clear, engaging content.

Your approach:
1. Understand the target audience and purpose
2. Organize content logically
3. Write clearly and engagingly
4. Edit for clarity and impact

Guidelines:
- Adapt tone and style to the context
- Use formatting to enhance readability
- Be concise but comprehensive
- Ensure accuracy in all claims`,
    tools: ['read_file', 'write_file'],
  },
};

// ============================================================
// CONFIG
// ============================================================

export const RESEARCH_CONFIG: AgentConfig = {
  name: 'research',
  description: 'A comprehensive research agent that gathers information, analyzes data, and produces well-structured reports.',
  systemPrompt: `You are a comprehensive research agent that gathers information, analyzes findings, and produces well-structured reports.

Your capabilities:
- **Research**: Use web_search to find current, relevant information from multiple sources
- **Analysis**: Synthesize information, identify patterns, and draw conclusions
- **Writing**: Create clear, well-organized reports and documents

Your workflow for research tasks:
1. **Understand** the research request and identify key questions to answer
2. **Search** using web_search to gather information from multiple sources
3. **Analyze** the findings, noting patterns, conflicts, and gaps
4. **Write** a comprehensive report using write_file to save your findings

IMPORTANT:
- Always use web_search to gather real, current information
- Make multiple searches to cover different aspects of the topic
- Cite your sources in the final report
- Save your final report using write_file with a descriptive filename
- Be thorough but concise in your analysis

When given a research task, immediately begin searching for information. Do not just plan - execute the research by calling web_search multiple times to gather comprehensive data.`,
  tools: [
    'web_search',
    'read_file',
    'write_file',
    'list_files',
  ],
  maxTurns: 20,
  model: 'claude-sonnet-4-20250514',
  temperature: 0.5,
};

// ============================================================
// AGENT CLASS
// ============================================================

export class ResearchAgent extends BaseAgent {
  private researchPhase: 'planning' | 'researching' | 'analyzing' | 'writing' | 'complete' = 'planning';

  constructor(env: Env) {
    super(RESEARCH_CONFIG, env);
  }

  /**
   * Add research context to the prompt
   */
  protected preprocessPrompt(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Detect research type
    let researchType = 'general';
    if (lowerPrompt.includes('compare') || lowerPrompt.includes('versus') || lowerPrompt.includes('vs')) {
      researchType = 'comparative';
    } else if (lowerPrompt.includes('analyze') || lowerPrompt.includes('analysis')) {
      researchType = 'analytical';
    } else if (lowerPrompt.includes('summarize') || lowerPrompt.includes('overview')) {
      researchType = 'summary';
    } else if (lowerPrompt.includes('trend') || lowerPrompt.includes('forecast')) {
      researchType = 'trend-analysis';
    }

    return `${prompt}

[Research type detected: ${researchType}]
[Available sub-agents: researcher, analyst, writer]`;
  }

  /**
   * Track research progress
   */
  protected async *postprocessMessages(
    messages: AsyncGenerator<SDKMessage>
  ): AsyncGenerator<SDKMessage> {
    for await (const message of messages) {
      // Track phase transitions based on tool use
      if (message.type === 'tool_use' && message.toolName === 'delegate_to_agent') {
        const input = message.toolInput as { agent?: string };
        if (input.agent === 'researcher') {
          this.researchPhase = 'researching';
        } else if (input.agent === 'analyst') {
          this.researchPhase = 'analyzing';
        } else if (input.agent === 'writer') {
          this.researchPhase = 'writing';
        }
      }

      if (message.type === 'done') {
        this.researchPhase = 'complete';
      }

      yield message;
    }
  }

  /**
   * Get current research phase
   */
  getPhase(): string {
    return this.researchPhase;
  }
}

// ============================================================
// FACTORY
// ============================================================

export function createResearchAgent(env: Env): ResearchAgent {
  return new ResearchAgent(env);
}
