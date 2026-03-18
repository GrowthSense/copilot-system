import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatMemoryService } from './chat.memory.service';
import { ChatRequestDto, ChatResponseDto, ChatErrorResponseDto } from './dto/chat.dto';
import { OptionalJwtGuard } from '../../common/guards/jwt.guard';
import { ok } from '../../common/utils/response.util';
import { ApiResponse } from '../../common/interfaces/api-response.interface';

interface AuthedRequest {
  user?: { sub: string; email: string };
}

@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly memory: ChatMemoryService,
  ) {}

  /**
   * POST /api/v1/chat
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtGuard)
  async chat(
    @Body() dto: ChatRequestDto,
    @Request() req: AuthedRequest,
  ): Promise<ApiResponse<ChatResponseDto> | ChatErrorResponseDto> {
    try {
      const result = await this.chatService.chat(dto, req.user?.sub);
      return ok(result, 'Chat response generated');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      const response: ChatErrorResponseDto = { error: true, message };
      return response;
    }
  }

  /**
   * GET /api/v1/chat/sessions?repoId=
   *
   * Returns sessions for the logged-in user only.
   */
  @Get('sessions')
  @UseGuards(OptionalJwtGuard)
  async listSessions(
    @Query('repoId') repoId: string | undefined,
    @Request() req: AuthedRequest,
  ) {
    const sessions = await this.memory.listSessions(req.user?.sub, repoId);
    return ok(sessions, 'Sessions retrieved');
  }

  /**
   * GET /api/v1/chat/sessions/:sessionId/messages
   */
  @Get('sessions/:sessionId/messages')
  async getMessages(@Param('sessionId') sessionId: string) {
    const messages = await this.memory.getSessionMessages(sessionId);
    return ok(messages, 'Messages retrieved');
  }
}
