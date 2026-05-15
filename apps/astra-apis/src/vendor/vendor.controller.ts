import type {PagedResponseDto} from '@ids/data-models';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {ApiBearerAuth, ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {Auth} from '../auth/auth.decorator';
import {AuthInfo} from '../auth/auth-utils';
import {VendorCreateDto, VendorCreateResponseDto} from './dto/vendor-create.dto';
import {VendorListQueryDto} from './dto/vendor-list.query.dto';
import {VendorUpdateDto} from './dto/vendor-update.dto';
import {VendorService} from './vendor.service';

@ApiTags('vendor')
@ApiBearerAuth()
@Controller('vendors')
export class VendorController {
  constructor(private readonly vendorService: VendorService) {}

  @Get()
  @ApiOperation({
    summary: 'List vendors',
    description: 'Paginated vendor list with optional search',
  })
  @ApiResponse({status: 200, description: 'Paginated list of vendors'})
  async findAll(
    @Query() query: VendorListQueryDto,
  ): Promise<PagedResponseDto<VendorCreateResponseDto>> {
    return this.vendorService.findAll({
      searchTerm: query.searchTerm,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  @Get(':id')
  @ApiOperation({summary: 'Get vendor by ID'})
  @ApiResponse({status: 200, description: 'Vendor found', type: VendorCreateResponseDto})
  @ApiResponse({status: 404, description: 'Vendor not found'})
  async findOne(@Param('id') id: string): Promise<VendorCreateResponseDto> {
    return this.vendorService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({summary: 'Create vendor'})
  @ApiResponse({status: 201, description: 'Vendor created', type: VendorCreateResponseDto})
  @ApiResponse({status: 409, description: 'Vendor code already exists'})
  async create(
    @Body() dto: VendorCreateDto,
    @Auth() auth: AuthInfo,
  ): Promise<VendorCreateResponseDto> {
    return this.vendorService.create(dto, auth.sub);
  }

  @Patch(':id')
  @ApiOperation({summary: 'Update vendor'})
  @ApiResponse({status: 200, description: 'Vendor updated', type: VendorCreateResponseDto})
  @ApiResponse({status: 404, description: 'Vendor not found'})
  async update(
    @Param('id') id: string,
    @Body() dto: VendorUpdateDto,
    @Auth() auth: AuthInfo,
  ): Promise<VendorCreateResponseDto> {
    return this.vendorService.update(id, dto, auth.sub);
  }
}
