import {PaginationQueryDto} from '@ids/data-models';
import {ApiPropertyOptional} from '@nestjs/swagger';
import {IsBooleanString, IsOptional, IsString, MaxLength} from 'class-validator';

export class UserListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({description: 'Search in name, email, and username', maxLength: 200})
  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchTerm?: string;

  @ApiPropertyOptional({description: 'Filter by deleted status (true/false)'})
  @IsOptional()
  @IsBooleanString()
  isDeleted?: string;
}
