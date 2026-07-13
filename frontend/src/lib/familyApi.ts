// ─────────────────────────────────────────────────────────────
//  familyApi.ts
//  The single API client for every parent/child request.
//  Every function here was verified line-by-line against the
//  real backend (Hafeez's Fastify API) before being trusted.
// ─────────────────────────────────────────────────────────────

const API_BASE = '/api';

// ── Token storage ───────────────────────────────────────────
// Parent and child tokens are kept completely separate so a
// child PIN session never inherits parent-level access, and
// signing one out never logs the other out.

const PARENT_TOKEN_KEY = 'family_parent_token';
const CHILD_TOKEN_KEY = 'family_child_token';

export function getParentToken(): string | null {
  return localStorage.getItem(PARENT_TOKEN_KEY);
}
export function setParentToken(token: string) {
  localStorage.setItem(PARENT_TOKEN_KEY, token);
}
export function clearParentToken() {
  localStorage.removeItem(PARENT_TOKEN_KEY);
}

export function getChildToken(): string | null {
  return localStorage.getItem(CHILD_TOKEN_KEY);
}
export function setChildToken(token: string) {
  localStorage.setItem(CHILD_TOKEN_KEY, token);
}
export function clearChildToken() {
  localStorage.removeItem(CHILD_TOKEN_KEY);
}

// ── Error handling ──────────────────────────────────────────

export interface MissingField {
  key: string;
  label: string;
}

export class FamilyApiError extends Error {
  status: number;
  missingFields?: MissingField[];
  constructor(message: string, status: number, missingFields?: MissingField[]) {
    super(message);
    this.status = status;
    this.missingFields = missingFields;
  }
}

async function throwOnError(res: Response): Promise<void> {
  if (res.ok) return;
  let body: any = {};
  try {
    body = await res.json();
  } catch {
    // response had no JSON body
  }
  const message = body?.message || body?.error || `Request failed (${res.status})`;
  throw new FamilyApiError(message, res.status, body?.missing_fields);
}

// ── Core fetch wrapper ──────────────────────────────────────
// Default token is the PARENT token unless explicitly overridden.
// Pass `null` for endpoints that need no auth (e.g. register, login).
// Pass `getChildToken()` for child-authenticated requests.

async function familyFetch(
  path: string,
  options: RequestInit = {},
  tokenOverride?: string | null
): Promise<Response> {
  const token = tokenOverride !== undefined ? tokenOverride : getParentToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

// ── Types ────────────────────────────────────────────────────

export interface Parent {
  id: number;
  uuid: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'parent';
}

export interface Child {
  id: number;
  uuid: string;
  name: string;
  date_of_birth: string;
  status: string;
  age: number;
  age_band: 'little' | 'young' | 'middle' | 'older';
  total_stories_watched?: number;
}

export interface ChildSession {
  id: number;
  uuid: string;
  name: string;
  age: number;
  age_band: string;
  role: 'child';
}

export interface StoryValue {
  id: number;
  value_key: string;
  label: string;
  description: string;
  colour_hex: string;
}

export interface Story {
  id: number;
  uuid: string;
  title: string;
  synopsis: string;
  thumbnail_url: string | null;
  age_min: number;
  age_max: number;
  reading_time_mins: number;
  value_label: string;
  value_colour: string;
}

export interface GeneratedScene {
  scene_number: number;
  content: string;
  image_prompt: string;
}

export interface GeneratedStory {
  story: {
    personalised_title: string;
    value: string;
    value_colour: string;
    outcome_focus: string | null;
    reading_time_mins: number;
  };
  story_content: string;
  scenes: GeneratedScene[];
  discussion_prompts: string | null | Record<string, unknown>;
  video_job: unknown | null;
}

// ── Parent: register ────────────────────────────────────────

export async function registerParent(data: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}): Promise<{ message: string; parent_id: number; email: string }> {
  const res = await familyFetch(
    '/auth/parent/register',
    { method: 'POST', body: JSON.stringify(data) },
    null
  );
  await throwOnError(res);
  return res.json();
}

// ── Parent: login step 1 ────────────────────────────────────

export async function parentLogin(
  email: string,
  password: string
): Promise<{ message: string; parent_id: number }> {
  const res = await familyFetch(
    '/auth/parent/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    null
  );
  await throwOnError(res);
  return res.json();
}

// ── Parent: login step 2 — verify 2FA code ──────────────────

export async function verifyParent2FA(
  parent_id: number,
  code: string
): Promise<{ message: string; token: string; parent: Parent }> {
  const res = await familyFetch(
    '/auth/parent/verify-2fa',
    { method: 'POST', body: JSON.stringify({ parent_id, code }) },
    null
  );
  await throwOnError(res);
  return res.json();
}

// ── Children: list / create ─────────────────────────────────

export async function getChildren(): Promise<{ children: Child[]; total: number }> {
  const res = await familyFetch('/children', { method: 'GET' });
  await throwOnError(res);
  return res.json();
}

export async function addChild(data: {
  name: string;
  date_of_birth: string;
  pin: string;
  appearance_profile: {
    skin_tone: string;
    hair_colour: string;
    hair_type: string;
    gender_expression: string;
    glasses: boolean;
  };
}): Promise<{ message: string; child: Child }> {
  const res = await familyFetch('/children', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  await throwOnError(res);
  return res.json();
}

// ── Child: PIN login ─────────────────────────────────────────

export async function childLogin(
  parent_id: number,
  child_id: number,
  pin: string
): Promise<{ message: string; token: string; child: ChildSession }> {
  const res = await familyFetch(
    '/auth/child/login',
    { method: 'POST', body: JSON.stringify({ parent_id, child_id, pin }) },
    null
  );
  await throwOnError(res);
  return res.json();
}

// ── Stories: library ────────────────────────────────────────

export async function getStoryValues(): Promise<{ values: StoryValue[] }> {
  const res = await familyFetch('/stories/values', { method: 'GET' }, getChildToken());
  await throwOnError(res);
  return res.json();
}

export async function getStories(): Promise<{ stories: Story[]; total: number }> {
  const res = await familyFetch('/stories', { method: 'GET' }, getChildToken());
  await throwOnError(res);
  return res.json();
}

export interface PersonalisationField {
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'color' | 'image' | 'select';
  scope: 'profile' | 'story';
  age_adaptive: boolean;
  age_prompts_json: string | Record<string, string> | null;
  options_json: string | string[] | null;
  sort_order: number;
}

export interface ProfileAnswer {
  field_key: string;
  label: string;
  field_type: string;
  scope: string;
  value: string;
  updated_at: string;
}

// ── Personalisation: list all available fields ─────────────

export async function getPersonalisationFields(): Promise<{ fields: PersonalisationField[] }> {
  const res = await familyFetch('/personalisation/fields', { method: 'GET' }, getChildToken());
  await throwOnError(res);
  return res.json();
}

// ── Personalisation: get a child's saved answers ────────────

export async function getChildProfile(
  childId: number
): Promise<{ child_id: number; child_name: string; profile: ProfileAnswer[] }> {
  const res = await familyFetch(`/personalisation/${childId}`, { method: 'GET' });
  await throwOnError(res);
  return res.json();
}

// ── Personalisation: save answers (UPSERT) ──────────────────

export async function savePersonalisationAnswers(
  childId: number,
  answers: { field_key: string; value: string }[]
): Promise<{ message: string; child_id: number; saved_count: number }> {
  const res = await familyFetch(`/personalisation/${childId}`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
  await throwOnError(res);
  return res.json();
}

// ── Story generation — THE CORE ENGINE ──────────────────────
// Uses the PARENT token (the default) — confirmed required by
// the backend's requireParent middleware, even though this is
// triggered from a child-facing page.

export async function generateStory(
  child_id: number,
  story_id: number
): Promise<GeneratedStory> {
  const res = await familyFetch('/story-generation', {
    method: 'POST',
    body: JSON.stringify({ child_id, story_id, queue_video: false }),
  });
  await throwOnError(res);
  return res.json();
}
