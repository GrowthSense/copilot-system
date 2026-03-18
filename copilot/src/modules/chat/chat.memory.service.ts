import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ChatMessage, ChatRole } from './chat.types';

/** Number of most-recent messages forwarded to the LLM as history. */
const MAX_CONTEXT_MESSAGES = 10;

/** Number of words from the first user message used as the session title. */
const TITLE_WORD_LIMIT = 8;

export interface ChatSessionSummary {
  id: string;
  repoId: string | null;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

@Injectable()
export class ChatMemoryService {
  private readonly logger = new Logger(ChatMemoryService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Ensure a session row exists, creating it if necessary.
   * Returns the session id (same as the input).
   */
  async ensureSession(sessionId: string, repoId?: string, userId?: string): Promise<string> {
    const existing = await this.db.chatSession.findUnique({ where: { id: sessionId } });
    if (!existing) {
      await this.db.chatSession.create({
        data: { id: sessionId, repoId: repoId ?? null, userId: userId ?? null, title: 'New Chat' },
      });
      this.logger.debug(`Created session "${sessionId}" userId=${userId ?? 'anon'}`);
    } else if (userId && !existing.userId) {
      // Claim an anonymous session for the logged-in user on first interaction.
      await this.db.chatSession.update({ where: { id: sessionId }, data: { userId } });
    }
    return sessionId;
  }

  /**
   * Return all stored messages for a session as the legacy in-memory shape.
   */
  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const rows = await this.db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({ role: r.role as ChatRole, content: r.content, timestamp: r.createdAt }));
  }

  /**
   * Return the last N messages for LLM context (previous turns, excluding the current message).
   */
  async getContextWindow(sessionId: string): Promise<ChatMessage[]> {
    // Fetch newest-first, then reverse so the LLM sees chronological order.
    const rows = await this.db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: MAX_CONTEXT_MESSAGES,
    });
    return rows
      .reverse()
      .map((r) => ({ role: r.role as ChatRole, content: r.content, timestamp: r.createdAt }));
  }

  /**
   * Append a message to the session and auto-update the session title
   * from the first user message.
   */
  async addMessage(sessionId: string, role: ChatRole, content: string): Promise<void> {
    await this.db.chatMessage.create({ data: { sessionId, role, content } });

    // Auto-title from the first user message
    if (role === 'user') {
      const session = await this.db.chatSession.findUnique({ where: { id: sessionId } });
      if (session && session.title === 'New Chat') {
        const title = content
          .trim()
          .split(/\s+/)
          .slice(0, TITLE_WORD_LIMIT)
          .join(' ')
          .replace(/[^\w\s.,!?-]/g, '')
          .trim();
        if (title) {
          await this.db.chatSession.update({
            where: { id: sessionId },
            data: { title: title.length < content.trim().length ? `${title}…` : title },
          });
        }
      }
    }

    this.logger.debug(`Session "${sessionId}": added ${role} message`);
  }

  /** Delete all messages for a session. */
  async clearSession(sessionId: string): Promise<void> {
    await this.db.chatMessage.deleteMany({ where: { sessionId } });
    this.logger.debug(`Session "${sessionId}" cleared`);
  }

  /** List sessions for a user (or anonymous sessions when userId is absent), newest first. */
  async listSessions(userId: string | undefined, repoId?: string): Promise<ChatSessionSummary[]> {
    const sessions = await this.db.chatSession.findMany({
      where: {
        OR: userId ? [{ userId }, { userId: null }] : [{ userId: null }],
        ...(repoId ? { repoId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: { _count: { select: { messages: true } } },
    });
    return sessions.map((s) => ({
      id: s.id,
      repoId: s.repoId,
      title: s.title,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
    }));
  }

  /** Get all messages for a session. */
  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    return this.getHistory(sessionId);
  }
}
