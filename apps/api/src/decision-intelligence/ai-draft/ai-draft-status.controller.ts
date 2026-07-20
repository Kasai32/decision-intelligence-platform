import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AiDraftService } from './ai-draft.service';

@ApiTags('decision-intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('decision-intelligence')
export class AiDraftStatusController {
  constructor(private readonly aiDraft: AiDraftService) {}

  /** Lets the frontend show/hide the "Draft with AI" button without guessing. */
  @Get('ai-status')
  getStatus(): { available: boolean } {
    return { available: this.aiDraft.available };
  }
}
