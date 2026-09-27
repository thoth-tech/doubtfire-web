import {Injectable} from '@angular/core';

export interface FeedbackDraftContext {
  userId: number;
  unitId: number | null;
  projectId: number;
  taskDefinitionId: number;
  taskId: number | null;
  conversation: 'task-feedback';
}

export type StagedAttachmentStatus = 'staged' | 'uploading' | 'failed';

export interface StagedFeedbackAttachment {
  data: File | Blob;
  fileName: string;
  mimeType: string;
  byteSize: number;
  kind: 'file' | 'audio';
  clientRequestId: string;
  status: StagedAttachmentStatus;
  progress: number;
  error?: string;
}

export interface FeedbackDraftSnapshot {
  text: string;
  replyToId: number | null;
  clientRequestId: string | null;
  // The reply target and text the request id was issued for.
  clientRequestFingerprint: string | null;
  updatedAt: number;
}

/**
 * Keeps feedback drafts isolated to one signed-in user and one conversation.
 * Text and reply context survive a normal browser resume. Raw File/Blob objects
 * stay memory-only so private attachments are never copied into browser storage.
 */
@Injectable({providedIn: 'root'})
export class FeedbackDraftStore {
  static readonly STORAGE_PREFIX = 'feedback_draft_v1';
  private readonly volatileAttachments: Map<string, StagedFeedbackAttachment[]> = new Map();

  key(context: FeedbackDraftContext): string {
    return [
      FeedbackDraftStore.STORAGE_PREFIX,
      `uid${context.userId}`,
      `unit${context.unitId ?? 0}`,
      `project${context.projectId}`,
      `definition${context.taskDefinitionId}`,
      `task${context.taskId ?? 0}`,
      context.conversation,
    ].join('_');
  }

  load(context: FeedbackDraftContext): FeedbackDraftSnapshot {
    const empty: FeedbackDraftSnapshot = {
      text: '',
      replyToId: null,
      clientRequestId: null,
      clientRequestFingerprint: null,
      updatedAt: 0,
    };
    try {
      const raw = sessionStorage.getItem(this.key(context));
      if (!raw) {
        return empty;
      }
      const parsed = JSON.parse(raw) as Partial<FeedbackDraftSnapshot>;
      return {
        text: typeof parsed.text === 'string' ? parsed.text : '',
        replyToId: typeof parsed.replyToId === 'number' ? parsed.replyToId : null,
        clientRequestId: typeof parsed.clientRequestId === 'string' ? parsed.clientRequestId : null,
        clientRequestFingerprint:
          typeof parsed.clientRequestFingerprint === 'string'
            ? parsed.clientRequestFingerprint
            : null,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      };
    } catch {
      return empty;
    }
  }

  save(
    context: FeedbackDraftContext,
    text: string,
    replyToId: number | null,
    clientRequestId: string | null = null,
    clientRequestFingerprint: string | null = null,
  ): void {
    const key = this.key(context);
    try {
      if (
        !this.hasMeaningfulText(text) &&
        replyToId === null &&
        !this.volatileAttachments.has(key)
      ) {
        sessionStorage.removeItem(key);
        return;
      }
      const prior = this.load(context);
      const snapshot: FeedbackDraftSnapshot = {
        text,
        replyToId,
        clientRequestId: clientRequestId ?? prior.clientRequestId,
        // Keep the id and its fingerprint together, whichever one is kept.
        clientRequestFingerprint: clientRequestId
          ? clientRequestFingerprint
          : prior.clientRequestFingerprint,
        updatedAt: Date.now(),
      };
      sessionStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // Storage may be unavailable in private browsing; the composer remains usable.
    }
  }

  attachments(context: FeedbackDraftContext): StagedFeedbackAttachment[] {
    return this.volatileAttachments.get(this.key(context)) ?? [];
  }

  stageAttachment(context: FeedbackDraftContext, attachment: StagedFeedbackAttachment): void {
    const key = this.key(context);
    this.volatileAttachments.set(key, [...(this.volatileAttachments.get(key) ?? []), attachment]);
  }

  updateAttachment(
    context: FeedbackDraftContext,
    clientRequestId: string,
    update: Partial<StagedFeedbackAttachment>,
  ): void {
    const key = this.key(context);
    const attachments = this.volatileAttachments.get(key) ?? [];
    this.volatileAttachments.set(
      key,
      attachments.map((attachment) =>
        attachment.clientRequestId === clientRequestId ? {...attachment, ...update} : attachment,
      ),
    );
  }

  removeAttachment(context: FeedbackDraftContext, clientRequestId: string): void {
    const key = this.key(context);
    const remaining = (this.volatileAttachments.get(key) ?? []).filter(
      (attachment) => attachment.clientRequestId !== clientRequestId,
    );
    if (remaining.length > 0) {
      this.volatileAttachments.set(key, remaining);
    } else {
      this.volatileAttachments.delete(key);
    }
  }

  clear(context: FeedbackDraftContext): void {
    const key = this.key(context);
    this.volatileAttachments.delete(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // See save(): storage failure must not break feedback.
    }
  }

  clearUser(userId: number): void {
    const marker = `_uid${userId}_`;
    for (const key of Array.from(this.volatileAttachments.keys())) {
      if (key.includes(marker)) {
        this.volatileAttachments.delete(key);
      }
    }
    try {
      const keys: string[] = [];
      for (let index = 0; index < sessionStorage.length; index++) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(FeedbackDraftStore.STORAGE_PREFIX) && key.includes(marker)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => sessionStorage.removeItem(key));
    } catch {
      // Sign out continues even when storage is unavailable.
    }
  }

  private hasMeaningfulText(text: string): boolean {
    return text.replace(/\s+/g, '').length > 0;
  }
}
