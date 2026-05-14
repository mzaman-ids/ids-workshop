import {PaginationQueryDto} from '@ids/data-models';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsIn, IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class AdjustmentListQueryDto extends PaginationQueryDto {
  @ApiProperty({description: 'Location ID to filter by (required)'})
  @IsNotEmpty()
  @IsString()
  locationId!: string;

  @ApiPropertyOptional({description: 'Filter by specific part number'})
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({description: 'Free text search on part number or description'})
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({enum: ['add', 'remove']})
  @IsOptional()
  @IsIn(['add', 'remove'])
  type?: 'add' | 'remove';
}
