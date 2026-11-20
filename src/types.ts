export type VoiceName = string;

export interface PersonaData {
  label: string;
  prompt: string;
  greeting: string;
  suggestions?: string[];
  description?: string;
  quote?: string;
  color?: string;
  icon?: string;
  avatarUrl?: string;
  era?: string;
  title?: string;
  voice: VoiceName;
  ttsTone: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  files?: { name: string, mimeType: string, data: string }[];
  persona?: string;
  isSystem?: boolean;
  originalIndex?: number;
  simulationScore?: number;
  sources?: { title: string, uri: string }[];
}

export interface TimelineMilestone {
  year: string;
  era: string;
  title: string;
  summary: string;
  keyThinkers: string[];
  impactOnAGI?: string;
}

export interface SchoolOfThought {
  id: string;
  name: string;
  era: string;
  icon: string;
  color: string;
  thesis: string;
  description: string;
  keyMinds: string[];
  principles: string[];
  historicalStages: { stage: string; period: string; summary: string }[];
  footprint: string;
  evolutionToAGI: string;
  isCustom?: boolean;
}

export interface LearningPathway {
  id: string;
  title: string;
  mentor: string;
  mentorId: string;
  icon: string;
  color: string;
  description: string;
  level: string;
  topics: string[];
  dilemma: {
    title: string;
    scenario: string;
    question: string;
    options?: string[];
  };
}

export interface SavedLesson {
  id: string;
  title: string;
  takeaway: string;
  sourcePersona: string;
  personaLabel: string;
  quote?: string;
  category?: string;
  tags: string[];
  createdAt: string;
  notes?: string;
}

export interface SavedCodeSnippet {
  id: string;
  filePath: string;
  language: string;
  code: string;
  personaName: string;
  createdAt: string;
  description?: string;
}

export interface UserProfileDataSource {
  id: string;
  name: string;
  type: 'pdf' | 'text' | 'url' | 'note';
  snippet?: string;
  size?: string;
  addedAt: string;
}

export interface SavedConversationSession {
  id: string;
  title: string;
  personaId: string;
  messageCount: number;
  savedAt: string;
  messages: Message[];
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  personaId: string; // associated persona key
  createdAt: string;
  dataSources: UserProfileDataSource[];
  parameters: {
    voice?: VoiceName;
    ttsTone?: string;
    reasoningStyle?: string;
    temperature?: number;
    systemPromptOverride?: string;
  };
  savedSessions: SavedConversationSession[];
}

export interface PersonaComparisonAspect {
  aspectName: string; // e.g., "Language Pattern", "Core Values", "Reasoning Method"
  personasData: Record<string, string>; // personaName -> summary text
}

export interface PersonaComparisonResult {
  personasCompared: string[];
  summary: string;
  languagePatterns: Record<string, { tone: string; vocabulary: string; style: string }>;
  statedValues: Record<string, string[]>;
  reasoningProcesses: Record<string, { logicType: string; decisionApproach: string; corePremise: string }>;
  keyDifferences: string[];
  synergyOrConflict: string;
}

export interface SavedConcept {
  id: string;
  concept: string;
  baseExplanation: string;
  fullExplanation: string;
  personaName: string;
  messageContext: string;
  createdAt: string;
  tags: string[];
}

export interface GroundedImageResult {
  title: string;
  url: string;
  sourceDomain: string;
  sourceUri: string;
  description: string;
  contextTag?: string;
  dimensions?: string;
}

export interface GroundedImageResponse {
  analysis: string;
  predictedQuery: string;
  images: GroundedImageResult[];
  groundingSources: { title: string; uri: string }[];
  suggestedVisualTopics: string[];
}

export type AppTheme = 'light' | 'dark' | 'system' | 'calculator-gray' | 'plain-text';
