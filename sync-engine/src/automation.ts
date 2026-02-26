import { query } from './db.js';
import { log } from './logger.js';
import type { ParsedEmail } from './parser.js';

export type DestinationMatchType = 'exact' | 'contains' | 'regex';
export type DestinationTargetField =
  | 'destinationAddress'
  | 'destinationLocalPart'
  | 'destinationPlusTag'
  | 'originAddress'
  | 'originLocalPart'
  | 'emailSubject';

interface AutomationLabelRule {
  id: string;
  enabled: boolean;
  priority: number;
  targetField: DestinationTargetField;
  matchType: DestinationMatchType;
  pattern: string;
  caseSensitive: boolean;
  labelMode: 'fixed' | 'template';
  labelName: string;
  labelTemplate: string;
}

interface AutomationWebhookRule {
  id: string;
  enabled: boolean;
  priority: number;
  targetField: DestinationTargetField;
  matchType: DestinationMatchType;
  pattern: string;
  caseSensitive: boolean;
  endpointUrl: string;
}

interface LoadedAutomationConfig {
  labelRules: AutomationLabelRule[];
  webhookRules: AutomationWebhookRule[];
  labelStopAfterFirst: boolean;
  webhookStopAfterFirst: boolean;
}

interface DbLabelRuleRow {
  id: string;
  enabled: boolean;
  priority: number;
  target_field: DestinationTargetField;
  match_type: DestinationMatchType;
  pattern: string;
  case_sensitive: boolean;
  label_mode: 'fixed' | 'template';
  label_name: string;
  label_template: string;
}

interface DbWebhookRuleRow {
  id: string;
  enabled: boolean;
  priority: number;
  target_field: DestinationTargetField;
  match_type: DestinationMatchType;
  pattern: string;
  case_sensitive: boolean;
  endpoint_url: string;
}

const MAX_WEBHOOK_RESPONSE_PREVIEW = 1200;
const MAX_WEBHOOK_ERROR_PREVIEW = 400;
const MAX_WEBHOOK_REQUEST_PREVIEW = 1200;
const WEBHOOK_HISTORY_LIMIT = 500;

function clipped(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function normalizeEmailAddress(input: string): string {
  return input.trim().toLowerCase();
}

function extractEmailFromHeader(value: string): string {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const candidate = (angleMatch?.[1] || trimmed).trim();
  if (!candidate.includes('@')) return '';
  return normalizeEmailAddress(candidate);
}

function extractHeaderValues(headers: Record<string, string>, name: string): string[] {
  const raw = headers[name.toLowerCase()];
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/\r?\n|,/) // tolerate folded / comma-separated values
    .map((value) => value.trim())
    .filter(Boolean);
}

function getDestinationAddresses(parsed: ParsedEmail): string[] {
  const fromEnvelope = [
    ...extractHeaderValues(parsed.headers, 'delivered-to'),
    ...extractHeaderValues(parsed.headers, 'x-original-to'),
  ]
    .map(extractEmailFromHeader)
    .filter((value) => value.includes('@'));

  const fromRecipients = [...parsed.to, ...parsed.cc]
    .map((entry) => normalizeEmailAddress(entry.address || ''))
    .filter((value) => value.includes('@'));

  return Array.from(new Set([...fromEnvelope, ...fromRecipients]));
}

function getOriginAddress(parsed: ParsedEmail): string {
  const direct = normalizeEmailAddress(parsed.from?.address || '');
  if (direct.includes('@')) return direct;
  return '';
}

function getRuleTargetValues(parsed: ParsedEmail, targetField: DestinationTargetField): string[] {
  if (targetField === 'emailSubject') {
    const subject = (parsed.subject || '').trim();
    return subject ? [subject] : [];
  }

  if (targetField === 'originAddress') {
    const origin = getOriginAddress(parsed);
    return origin ? [origin] : [];
  }

  if (targetField === 'originLocalPart') {
    const origin = getOriginAddress(parsed);
    if (!origin) return [];
    const local = origin.split('@')[0] || '';
    return local ? [local] : [];
  }

  const addresses = getDestinationAddresses(parsed);
  if (targetField === 'destinationAddress') return addresses;

  if (targetField === 'destinationLocalPart') {
    return Array.from(new Set(addresses.map((addr) => addr.split('@')[0] || '').filter(Boolean)));
  }

  return Array.from(new Set(addresses
    .map((addr) => {
      const local = addr.split('@')[0] || '';
      const plusIdx = local.indexOf('+');
      return plusIdx >= 0 ? local.slice(plusIdx + 1).trim() : '';
    })
    .filter(Boolean)));
}

function matchRule(
  values: string[],
  pattern: string,
  matchType: DestinationMatchType,
  caseSensitive: boolean,
): { candidate: string; regexMatch: RegExpExecArray | null } | null {
  if (!pattern || values.length === 0) return null;
  if (matchType === 'regex') {
    try {
      const regex = new RegExp(pattern, caseSensitive ? '' : 'i');
      for (const value of values) {
        const match = regex.exec(value);
        if (match) return { candidate: value, regexMatch: match };
      }
    } catch {
      return null;
    }
    return null;
  }

  const needle = caseSensitive ? pattern : pattern.toLowerCase();
  for (const value of values) {
    const haystack = caseSensitive ? value : value.toLowerCase();
    if (matchType === 'exact' && haystack === needle) return { candidate: value, regexMatch: null };
    if (matchType === 'contains' && haystack.includes(needle)) return { candidate: value, regexMatch: null };
  }

  return null;
}

function renderLabelTemplate(template: string, candidate: string, regexMatch: RegExpExecArray | null): string {
  return template
    .replace(/\$0/g, candidate)
    .replace(/\$(\d+)/g, (_full, num) => {
      const idx = Number(num);
      if (!Number.isFinite(idx) || idx < 1) return '';
      return regexMatch?.[idx] ?? '';
    })
    .trim();
}

async function loadAutomationConfig(accountEmail: string): Promise<LoadedAutomationConfig> {
  const [settingsResult, labelRulesResult, webhookRulesResult] = await Promise.all([
    query<{
      label_stop_after_first_match: boolean;
      webhook_stop_after_first_match: boolean;
    }>(
      `SELECT label_stop_after_first_match, webhook_stop_after_first_match
       FROM automation_rule_settings
       WHERE account_email = $1`,
      [accountEmail],
    ),
    query<DbLabelRuleRow>(
      `SELECT id, enabled, priority, target_field, match_type, pattern, case_sensitive, label_mode, label_name, label_template
       FROM automation_label_rules
       WHERE account_email = $1
       ORDER BY priority ASC, created_at ASC`,
      [accountEmail],
    ),
    query<DbWebhookRuleRow>(
      `SELECT id, enabled, priority, target_field, match_type, pattern, case_sensitive, endpoint_url
       FROM automation_webhook_rules
       WHERE account_email = $1
       ORDER BY priority ASC, created_at ASC`,
      [accountEmail],
    ),
  ]);

  const settings = settingsResult.rows[0];
  const labelRules = labelRulesResult.rows
    .filter((row) => row.enabled && row.pattern.trim())
    .map<AutomationLabelRule>((row) => ({
      id: row.id,
      enabled: row.enabled,
      priority: row.priority,
      targetField: row.target_field,
      matchType: row.match_type,
      pattern: row.pattern,
      caseSensitive: row.case_sensitive,
      labelMode: row.label_mode,
      labelName: row.label_name,
      labelTemplate: row.label_template,
    }));

  const webhookRules = webhookRulesResult.rows
    .filter((row) => row.enabled && row.pattern.trim() && row.endpoint_url.trim())
    .map<AutomationWebhookRule>((row) => ({
      id: row.id,
      enabled: row.enabled,
      priority: row.priority,
      targetField: row.target_field,
      matchType: row.match_type,
      pattern: row.pattern,
      caseSensitive: row.case_sensitive,
      endpointUrl: row.endpoint_url,
    }));

  return {
    labelRules,
    webhookRules,
    labelStopAfterFirst: Boolean(settings?.label_stop_after_first_match),
    webhookStopAfterFirst: Boolean(settings?.webhook_stop_after_first_match),
  };
}

async function appendLabelFlag(folderId: string, uid: number, labelName: string): Promise<void> {
  await query(
    `UPDATE messages
       SET flags = CASE
             WHEN $3 = ANY(flags) THEN flags
             ELSE array_append(flags, $3)
           END,
           updated_at = now()
     WHERE folder_id = $1 AND uid = $2`,
    [folderId, uid, labelName],
  );
}

async function recordWebhookHistory(params: {
  accountEmail: string;
  endpointUrl: string;
  status: 'success' | 'http_error' | 'network_error';
  httpStatus: number | null;
  errorMessage?: string | null;
  responsePreview?: string | null;
  requestBodyPreview: string;
  folder: string;
  ruleId: string;
  rulePriority: number;
  targetField: string;
  matchType: string;
  matchedValue: string;
  emailSubject: string;
  emailFromAddress: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO webhook_delivery_history
       (account_email, endpoint_url, status, http_status, error_message, response_preview, request_body_preview,
        folder, rule_id, rule_priority, target_field, match_type, matched_value, email_subject, email_from_address)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      params.accountEmail,
      params.endpointUrl,
      params.status,
      params.httpStatus,
      params.errorMessage || null,
      params.responsePreview || null,
      clipped(params.requestBodyPreview, MAX_WEBHOOK_REQUEST_PREVIEW),
      params.folder,
      params.ruleId,
      params.rulePriority,
      params.targetField,
      params.matchType,
      params.matchedValue,
      params.emailSubject,
      params.emailFromAddress,
    ],
  );

  await query(
    `DELETE FROM webhook_delivery_history
      WHERE account_email = $1
        AND id NOT IN (
          SELECT id
          FROM webhook_delivery_history
          WHERE account_email = $1
          ORDER BY created_at DESC
          LIMIT $2
        )`,
    [params.accountEmail, WEBHOOK_HISTORY_LIMIT],
  );
}

async function dispatchWebhook(params: {
  accountEmail: string;
  parsed: ParsedEmail;
  folderPath: string;
  uid: number;
  rule: AutomationWebhookRule;
  match: { candidate: string; regexMatch: RegExpExecArray | null };
}): Promise<void> {
  const endpoint = params.rule.endpointUrl.trim();
  if (!endpoint) return;
  try {
    const parsedUrl = new URL(endpoint);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return;
  } catch {
    return;
  }

  const payload = {
    source: 'homerow-sync-engine',
    kind: 'destination_webhook_rule',
    triggeredAt: new Date().toISOString(),
    rule: {
      id: params.rule.id,
      priority: params.rule.priority,
      targetField: params.rule.targetField,
      matchType: params.rule.matchType,
      pattern: params.rule.pattern,
      caseSensitive: params.rule.caseSensitive,
    },
    match: {
      candidate: params.match.candidate,
      captures: params.match.regexMatch ? Array.from(params.match.regexMatch) : [],
    },
    folder: params.folderPath,
    email: {
      id: null,
      seq: params.uid,
      subject: params.parsed.subject,
      from: params.parsed.from?.name || params.parsed.from?.address || 'Unknown',
      fromAddress: params.parsed.from?.address || null,
      to: params.parsed.to.map((entry) => entry.address).filter(Boolean),
      cc: params.parsed.cc.map((entry) => entry.address).filter(Boolean),
      deliveredTo: getDestinationAddresses(params.parsed),
      date: params.parsed.date ? params.parsed.date.toISOString() : null,
      threadId: null,
      folderPath: params.folderPath,
      text: params.parsed.textBody,
      html: params.parsed.htmlBody,
    },
  };
  const requestBody = JSON.stringify(payload);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: requestBody,
    });
    const responsePreview = clipped((await response.text().catch(() => '')).trim(), MAX_WEBHOOK_RESPONSE_PREVIEW);
    await recordWebhookHistory({
      accountEmail: params.accountEmail,
      endpointUrl: endpoint,
      status: response.ok ? 'success' : 'http_error',
      httpStatus: response.status,
      responsePreview: responsePreview || null,
      requestBodyPreview: requestBody,
      folder: params.folderPath,
      ruleId: params.rule.id,
      rulePriority: params.rule.priority,
      targetField: params.rule.targetField,
      matchType: params.rule.matchType,
      matchedValue: params.match.candidate,
      emailSubject: params.parsed.subject || '',
      emailFromAddress: params.parsed.from?.address || null,
    });
    if (!response.ok) {
      log.warn('Automation webhook returned non-OK', { endpoint, status: response.status });
    }
  } catch (err) {
    await recordWebhookHistory({
      accountEmail: params.accountEmail,
      endpointUrl: endpoint,
      status: 'network_error',
      httpStatus: null,
      errorMessage: clipped(err instanceof Error ? err.message : String(err), MAX_WEBHOOK_ERROR_PREVIEW),
      requestBodyPreview: requestBody,
      folder: params.folderPath,
      ruleId: params.rule.id,
      rulePriority: params.rule.priority,
      targetField: params.rule.targetField,
      matchType: params.rule.matchType,
      matchedValue: params.match.candidate,
      emailSubject: params.parsed.subject || '',
      emailFromAddress: params.parsed.from?.address || null,
    });
    log.error('Automation webhook dispatch failed', { endpoint, error: String(err) });
  }
}

export async function applyAutomationForMessage(params: {
  accountId: string;
  accountEmail: string;
  folderId: string;
  folderPath: string;
  uid: number;
  parsed: ParsedEmail;
}): Promise<void> {
  try {
    const config = await loadAutomationConfig(params.accountEmail);
    if (!config.labelRules.length && !config.webhookRules.length) return;

    for (const rule of config.labelRules) {
      const values = getRuleTargetValues(params.parsed, rule.targetField);
      const match = matchRule(values, rule.pattern, rule.matchType, rule.caseSensitive);
      if (!match) continue;

      let labelName = '';
      if (rule.labelMode === 'fixed') {
        labelName = (rule.labelName || '').trim();
      } else {
        labelName = renderLabelTemplate(rule.labelTemplate || '', match.candidate, match.regexMatch);
      }

      if (labelName) {
        await appendLabelFlag(params.folderId, params.uid, labelName);
      }
      if (config.labelStopAfterFirst) break;
    }

    for (const rule of config.webhookRules) {
      const values = getRuleTargetValues(params.parsed, rule.targetField);
      const match = matchRule(values, rule.pattern, rule.matchType, rule.caseSensitive);
      if (!match) continue;

      await dispatchWebhook({
        accountEmail: params.accountEmail,
        parsed: params.parsed,
        folderPath: params.folderPath,
        uid: params.uid,
        rule,
        match,
      });

      if (config.webhookStopAfterFirst) break;
    }
  } catch (err) {
    log.error('Failed to apply automation rules', {
      accountId: params.accountId,
      folder: params.folderPath,
      uid: params.uid,
      error: String(err),
    });
  }
}
