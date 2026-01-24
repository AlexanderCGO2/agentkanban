export type UiBlockType = 'message' | 'suggestion' | 'status';
export type UiMessageRole = 'user' | 'assistant' | 'system';
export type UiStatusLevel = 'info' | 'warning' | 'error';

export interface UiBlockBase {
  id: string;
  type: UiBlockType;
}

export interface UiMessageBlock extends UiBlockBase {
  type: 'message';
  role: UiMessageRole;
  content: string;
}

export interface UiSuggestionBlock extends UiBlockBase {
  type: 'suggestion';
  text: string;
}

export interface UiStatusBlock extends UiBlockBase {
  type: 'status';
  level: UiStatusLevel;
  content: string;
}

export type UiBlock = UiMessageBlock | UiSuggestionBlock | UiStatusBlock;

export interface UiBlockEnvelope {
  blocks: UiBlock[];
}

export interface UiBlockEvent {
  type: 'block' | 'error' | 'complete';
  block?: UiBlock;
  message?: string;
}
