import type { WorkflowTemplate } from './types';

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  'literature-review': {
    name: 'Literature Review',
    description: 'Systematic review of academic and industry literature',
    steps: [
      { type: 'source', title: 'Gather Sources', description: 'Search academic databases, web, internal docs' },
      { type: 'process', title: 'Filter & Categorize', description: 'Apply inclusion criteria, tag by theme' },
      { type: 'analyze', title: 'Extract Key Findings', description: 'Pull quotes, data, methodologies' },
      { type: 'analyze', title: 'Synthesize Themes', description: 'Identify patterns, gaps, contradictions' },
      { type: 'output', title: 'Generate Report', description: 'Structured markdown with citations' },
    ],
  },
  'competitive-analysis': {
    name: 'Competitive Analysis',
    description: 'Analyze competitors and market positioning',
    steps: [
      { type: 'source', title: 'Identify Competitors', description: 'Direct, indirect, aspirational' },
      { type: 'process', title: 'Collect Data', description: 'Features, pricing, positioning, reviews' },
      { type: 'analyze', title: 'Gap Analysis', description: 'Compare against our offering' },
      { type: 'analyze', title: 'SWOT Mapping', description: 'Strengths, weaknesses, opportunities, threats' },
      { type: 'output', title: 'Strategy Doc', description: 'Recommendations with evidence' },
    ],
  },
  'user-research': {
    name: 'User Research',
    description: 'Understand users through interviews and observation',
    steps: [
      { type: 'source', title: 'Define Scope', description: 'Research questions, target users, hypotheses' },
      { type: 'process', title: 'Collect Data', description: 'Interviews, surveys, observations' },
      { type: 'analyze', title: 'Code & Tag', description: 'Affinity mapping, theme extraction' },
      { type: 'analyze', title: 'Build Personas', description: 'User archetypes with needs/goals' },
      { type: 'output', title: 'Insights Deck', description: 'Key findings + design implications' },
    ],
  },
  'data-analysis': {
    name: 'Data Analysis',
    description: 'Analyze quantitative data for insights',
    steps: [
      { type: 'source', title: 'Data Collection', description: 'Gather datasets from various sources' },
      { type: 'process', title: 'Clean & Validate', description: 'Handle missing values, outliers, format' },
      { type: 'analyze', title: 'Exploratory Analysis', description: 'Statistics, distributions, correlations' },
      { type: 'analyze', title: 'Deep Analysis', description: 'Hypothesis testing, modeling' },
      { type: 'output', title: 'Visualization & Report', description: 'Charts, insights, recommendations' },
    ],
  },
};

export const MINDMAP_TEMPLATES = {
  'brainstorm': {
    name: 'Brainstorming Session',
    structure: ['Central Idea', 'What', 'Why', 'How', 'Who', 'When'],
  },
  'project-plan': {
    name: 'Project Planning',
    structure: ['Project Goal', 'Phase 1', 'Phase 2', 'Phase 3', 'Resources', 'Risks'],
  },
  'decision-tree': {
    name: 'Decision Tree',
    structure: ['Decision', 'Option A', 'Option B', 'Option C', 'Criteria'],
  },
  'swot': {
    name: 'SWOT Analysis',
    structure: ['Topic', 'Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
  },
};
