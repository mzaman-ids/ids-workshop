import {PaginationQueryDto} from '@ids/data-models';
import {ApiProperty, ApiPropertyOptional} from '@nestjs/swagger';
import {IsIn, IsNotEmpty, IsOptional, IsString} from 'class-validator';

export class PoListQueryDto extends PaginationQueryDto {
  @ApiProperty({description: 'Location ID (required)'})
  @IsNotEmpty()
  @IsString()
  locationId!: string;

  @ApiPropertyOptional({description: 'Free text search on PO number or vendor name'})
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @ApiPropertyOptional({enum: ['draft', 'confirmed', 'received', 'cancelled']})
  @IsOptional()
  @IsIn(['draft', 'confirmed', 'received', 'cancelled'])
  status?: string;
}
