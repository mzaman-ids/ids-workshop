import {PaginationQueryDto} from '@ids/data-models';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {IsOptional, IsString, MaxLength} from 'class-validator';

export class VendorListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({description: 'Search by vendor code or name', maxLength: 200})
  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchTerm?: string;
}
