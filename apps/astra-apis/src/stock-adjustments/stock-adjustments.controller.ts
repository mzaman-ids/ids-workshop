import type {DbStockAdjustmentListItem, PagedResponseDto} from '@ids/data-models';
import {Body, Controller, Get, HttpCode, HttpStatus, Post, Query} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {Auth} from '../auth/auth.decorator';
import type {AuthInfo} from '../auth/auth-utils';
import {AdjustmentCreateDto} from './dto/adjustment-create.dto';
import {AdjustmentListQueryDto} from './dto/adjustment-list.query.dto';
import {StockAdjustmentsService} from './stock-adjustments.service';

@ApiTags('stock-adjustments')
@ApiBearerAuth()
@Controller('stock-adjustments')
export class StockAdjustmentsController {
  constructor(private readonly stockAdjustmentsService: StockAdjustmentsService) {}

  @Get()
  @ApiOperation({summary: 'List stock adjustments', description: 'Paginated, scoped to locationId'})
  @ApiResponse({status: 200, description: 'Paginated list of adjustments'})
  async findAll(
    @Query() query: AdjustmentListQueryDto,
  ): Promise<PagedResponseDto<DbStockAdjustmentListItem>> {
    return this.stockAdjustmentsService.findAll(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create stock adjustment',
    description: 'Applies inventory delta immediately',
  })
  @ApiResponse({status: 201, description: 'Adjustment created'})
  @ApiResponse({status: 400, description: 'Insufficient stock or part not stocked at location'})
  @ApiResponse({status: 404, description: 'Part not found'})
  async create(
    @Body() dto: AdjustmentCreateDto,
    @Auth() auth: AuthInfo,
  ): Promise<DbStockAdjustmentListItem> {
    return this.stockAdjustmentsService.create(dto, auth.sub);
  }
}
